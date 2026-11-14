import axios from "axios";
import deductCredits from "../utils/deductCredits.js";
import { checkAgentLimit } from "../config/agentlimit.js";
import { storeFile, describeExpiry } from "../utils/storage.js";

/* -------------------------------------------------------------------------- */
/*  Image providers                                                           */
/*                                                                            */
/*  No free service is up 100% of the time, so several are tried in order     */
/*  until one returns a picture. Default order (change it with the            */
/*  IMAGE_PROVIDERS environment variable):                                    */
/*    1. cloudflare   - Workers AI, FLUX.1 schnell. Free daily allowance,     */
/*                      needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.   */
/*    2. pollinations - free, no key, but throttled for anonymous use.        */
/*    3. gemini       - only if GOOGLE_API_KEY is set (free quota is small).  */
/* -------------------------------------------------------------------------- */

const DEFAULT_ORDER = "cloudflare,pollinations,gemini";

// Stop starting new providers once this much time has passed, so the whole
// request stays well inside the gateway's 3-minute limit.
const TOTAL_BUDGET_MS = 130000;

const EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

// A provider problem. It has no `status`/`data` fields on purpose, so it is
// never mistaken for a credit or rate-limit error of our own.
class ImageError extends Error {
  constructor(message, { notConfigured = false } = {}) {
    super(message);
    this.name = "ImageError";
    this.notConfigured = notConfigured;
  }
}

const describeHttpError = (error, label) => {
  const status = error.response?.status;
  const detail =
    error.response?.data?.errors?.[0]?.message ||
    error.response?.data?.error?.message ||
    error.message ||
    "request failed";

  return new ImageError(`${label}${status ? ` (${status})` : ""}: ${detail}`);
};

/* ------------------------------ Cloudflare -------------------------------- */

const generateWithCloudflare = async (prompt) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    throw new ImageError("Cloudflare is not configured", {
      notConfigured: true,
    });
  }

  const steps = Math.min(
    8,
    Math.max(1, Number(process.env.CLOUDFLARE_IMAGE_STEPS) || 6),
  );

  try {
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      { prompt: prompt.slice(0, 2000), steps },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 45000,
      },
    );

    // FLUX returns the picture as a base64 JPEG string.
    const base64 = response.data?.result?.image;

    if (!base64) {
      throw new ImageError("Cloudflare returned no image");
    }

    return { buffer: Buffer.from(base64, "base64"), mimeType: "image/jpeg" };
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw describeHttpError(error, "Cloudflare");
  }
};

/* ------------------------------ Pollinations ------------------------------ */

const generateWithPollinations = async (prompt) => {
  try {
    const seed = Math.floor(Math.random() * 1_000_000);

    const response = await axios.get(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 600))}` +
        `?width=1024&height=1024&nologo=true&seed=${seed}`,
      { responseType: "arraybuffer", timeout: 60000 },
    );

    const mimeType = String(response.headers?.["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    // The service can answer 200 with an error page instead of a picture.
    if (!mimeType.startsWith("image/")) {
      throw new ImageError(`Pollinations returned ${mimeType || "no image"}`);
    }

    return { buffer: Buffer.from(response.data), mimeType };
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw describeHttpError(error, "Pollinations");
  }
};

/* --------------------------------- Gemini --------------------------------- */

const getGeminiModels = () =>
  [
    process.env.GEMINI_IMAGE_MODEL,
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
  ]
    .map((name) => String(name || "").trim())
    .filter((name, index, all) => name && all.indexOf(name) === index);

// Finds the picture in a generateContent response.
// Returns { buffer, mimeType } or { problem } explaining why there is none.
export const extractImage = (data) => {
  const blocked = data?.promptFeedback?.blockReason;

  if (blocked) {
    return { problem: `The request was blocked (${blocked}).` };
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;

    if (inline?.data) {
      return {
        buffer: Buffer.from(inline.data, "base64"),
        mimeType: String(inline.mimeType || inline.mime_type || "image/png"),
      };
    }
  }

  const reason = data?.candidates?.[0]?.finishReason;
  const text = parts
    .map((part) => part.text)
    .filter(Boolean)
    .join(" ")
    .slice(0, 200);

  return {
    problem:
      text ||
      (reason && reason !== "STOP"
        ? `The model stopped (${reason}).`
        : "The model did not return an image."),
  };
};

const generateWithGemini = async (prompt) => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new ImageError("Gemini is not configured", { notConfigured: true });
  }

  let lastError;

  for (const model of getGeminiModels()) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GOOGLE_API_KEY,
          },
          timeout: 45000,
        },
      );

      const image = extractImage(response.data);

      if (image.problem) throw new ImageError(`Gemini: ${image.problem}`);

      return image;
    } catch (error) {
      lastError =
        error instanceof ImageError
          ? error
          : describeHttpError(error, `Gemini ${model}`);

      // Only "model not found" moves on to the next model name.
      if (error.response?.status !== 404) break;
    }
  }

  throw lastError;
};

/* ----------------------------- Provider chain ----------------------------- */

const PROVIDERS = {
  cloudflare: generateWithCloudflare,
  pollinations: generateWithPollinations,
  gemini: generateWithGemini,
};

const getProviderOrder = () =>
  String(process.env.IMAGE_PROVIDERS || DEFAULT_ORDER)
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name, index, all) => PROVIDERS[name] && all.indexOf(name) === index);

// Logged once, on the first image request, so the Render log shows which
// version of this file is running and which providers are set up.
let providersLogged = false;

const logProviders = () => {
  if (providersLogged) return;
  providersLogged = true;

  const status = {
    cloudflare:
      process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN
        ? "configured"
        : "NOT configured (set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN)",
    pollinations: "no key needed",
    gemini: process.env.GOOGLE_API_KEY ? "configured" : "not configured",
  };

  console.log(
    "Image agent (multi-provider). Order: " +
      getProviderOrder()
        .map((name) => `${name} [${status[name]}]`)
        .join(" -> "),
  );
};

export const generateImage = async (prompt) => {
  logProviders();

  const started = Date.now();
  const problems = [];

  for (const name of getProviderOrder()) {
    if (Date.now() - started > TOTAL_BUDGET_MS) {
      problems.push("ran out of time");
      break;
    }

    try {
      const image = await PROVIDERS[name](prompt);
      console.log(`Image generated with ${name}`);
      return image;
    } catch (error) {
      // A provider that isn't set up is skipped quietly.
      if (error.notConfigured) continue;

      console.warn(`Image provider ${name} failed: ${error.message}`);
      problems.push(error.message);
    }
  }

  throw new ImageError(
    problems.length > 0
      ? problems.join(" | ")
      : "No image provider is configured (set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN)",
  );
};

/* -------------------------------- The agent ------------------------------- */

export const visionAgent = async (state) => {
  try {
    await checkAgentLimit(state.userId, "vision");

    const { buffer, mimeType } = await generateImage(state.prompt);

    const contentType = mimeType.split(";")[0].trim().toLowerCase();
    const extension = EXTENSIONS[contentType] || "png";
    const filename = `image-${Date.now()}.${extension}`;

    const stored = await storeFile({
      filename,
      buffer,
      contentType,
      conversationId: state.conversationId,
    });

    // Charge only once the image really exists.
    await deductCredits(state.userId, "vision");

    return {
      ...state,
      files: [stored],
      aiResponse: `
# 🖼️ Image Generated Successfully!

![Generated Image](${stored.url})

${describeExpiry(stored)}
      `,
    };
  } catch (error) {
    // Credit (402/403/404) and rate-limit (429) errors must reach the client.
    if (error?.status && error?.data) throw error;

    console.error("Vision Agent Error:", error.message);

    return {
      ...state,
      aiResponse:
        "❌ I couldn't generate the image right now because the free image services are busy. Please try again in a minute.",
    };
  }
};

