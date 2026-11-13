import axios from "axios";
import deductCredits from "../utils/deductCredits.js";
import { checkAgentLimit } from "../config/agentlimit.js";
import { storeFile, describeExpiry } from "../utils/storage.js";

// Gemini image models ("Nano Banana"), tried in this order. Put your own
// choice first with GEMINI_IMAGE_MODEL in the agent environment. A model that
// Google no longer offers (404) is skipped and the next one is tried.
const getImageModels = () =>
  [
    process.env.GEMINI_IMAGE_MODEL,
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
  ]
    .map((name) => String(name || "").trim())
    .filter((name, index, all) => name && all.indexOf(name) === index);

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

// A problem with talking to Gemini. It deliberately has no `status`/`data`
// fields, so it is never mistaken for a credit or rate-limit error.
class GeminiError extends Error {
  constructor(message, { httpStatus = 0, notFound = false } = {}) {
    super(message);
    this.name = "GeminiError";
    this.httpStatus = httpStatus;
    this.notFound = notFound;
  }
}

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

const requestImage = async (model, prompt) => {
  try {
    const response = await axios.post(
      `${API_BASE}/${model}:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GOOGLE_API_KEY,
        },
        timeout: 120000,
      },
    );

    return response.data;
  } catch (error) {
    const httpStatus = error.response?.status || 0;
    const detail =
      error.response?.data?.error?.message || error.message || "request failed";

    throw new GeminiError(`Gemini ${model}: ${detail}`, {
      httpStatus,
      notFound: httpStatus === 404,
    });
  }
};

const generateImage = async (prompt) => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new GeminiError("GOOGLE_API_KEY is not set");
  }

  let lastError;

  for (const model of getImageModels()) {
    try {
      const data = await requestImage(model, prompt);
      const image = extractImage(data);

      if (image.problem) {
        throw new GeminiError(image.problem);
      }

      return image;
    } catch (error) {
      lastError = error;

      // Only "model not found" moves on to the next model. Anything else
      // (quota, blocked prompt, bad key) would fail the same way again.
      if (!error.notFound) break;

      console.warn(`Image model unavailable, trying the next one: ${error.message}`);
    }
  }

  throw lastError;
};

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

    const quota = error.httpStatus === 429 || error.httpStatus === 403;

    return {
      ...state,
      aiResponse: quota
        ? "❌ Image generation is not available right now (Gemini quota or billing). Please try again later."
        : `❌ Failed to generate image. ${error instanceof GeminiError ? error.message.replace(/^Gemini [^:]+: /, "") : ""}`.trim(),
    };
  }
};