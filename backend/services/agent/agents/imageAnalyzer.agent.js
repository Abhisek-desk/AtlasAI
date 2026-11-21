import axios from "axios";
import fs from "fs/promises";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import deductCredits from "../utils/deductCredits.js";
import { checkAgentLimit } from "../config/agentlimit.js";

/* -------------------------------------------------------------------------- */
/*  Image analysis                                                            */
/*                                                                            */
/*  1. Groq (qwen/qwen3.8-27b) answers in a second or two. It is tried first  */
/*     when GROQ_API_KEY is set. Change the model with GROQ_VISION_MODEL.     */
/*  2. Gemini (your existing imageAnalyzer model) is the fallback, and is     */
/*     also used for very large images.                                       */
/*  Order can be changed with IMAGE_ANALYZER_PROVIDERS (e.g. "gemini").       */
/* -------------------------------------------------------------------------- */

const DEFAULT_ORDER = "groq,gemini";
const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

// Groq is skipped for images bigger than this (sent as base64 text).
const GROQ_MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

const SYSTEM_PROMPT = `You are an image analysis assistant.
- Look only at the uploaded image and answer the user's question accurately.
- If there is text in the image, read it out exactly.
- If there are charts or tables, explain what they show.
- Use Markdown when it helps. Do not make things up.`;

// A provider problem. `skip` means "not set up / not suitable", which is not
// logged as a failure.
class AnalyzeError extends Error {
  constructor(message, { skip = false } = {}) {
    super(message);
    this.name = "AnalyzeError";
    this.skip = skip;
  }
}

const toText = (content) => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("");
  }

  return String(content ?? "");
};

// Some reasoning models put their thinking in <think> tags; never show it.
const cleanAnswer = (text) =>
  String(text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();

/* --------------------------------- Groq ----------------------------------- */

const analyzeWithGroq = async ({ prompt, base64, mimeType, size }) => {
  if (!process.env.GROQ_API_KEY) {
    throw new AnalyzeError("Groq is not configured", { skip: true });
  }

  if (size > GROQ_MAX_IMAGE_BYTES) {
    throw new AnalyzeError("Image is too large for Groq", { skip: true });
  }

  const body = {
    model: process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    temperature: 0.7,
    max_completion_tokens: 1024,
    stream: false,
  };

  const send = (payload) =>
    axios.post("https://api.groq.com/openai/v1/chat/completions", payload, {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

  try {
    let response;

    try {
      // Instruct mode: no long "thinking" phase, so the answer comes quickly.
      response = await send({ ...body, reasoning_effort: "none" });
    } catch (error) {
      // A model that doesn't know this setting answers 400: try without it.
      const message = JSON.stringify(error.response?.data || "");

      if (error.response?.status === 400 && /reasoning/i.test(message)) {
        response = await send(body);
      } else {
        throw error;
      }
    }

    const answer = cleanAnswer(response.data?.choices?.[0]?.message?.content);

    if (!answer) throw new AnalyzeError("Groq returned an empty answer");

    return answer;
  } catch (error) {
    if (error instanceof AnalyzeError) throw error;

    const status = error.response?.status;
    const detail =
      error.response?.data?.error?.message || error.message || "request failed";

    throw new AnalyzeError(`Groq${status ? ` (${status})` : ""}: ${detail}`);
  }
};

/* -------------------------------- Gemini ---------------------------------- */

const analyzeWithGemini = async ({ prompt, base64, mimeType }) => {
  const llm = await getModel("imageAnalyzer");

  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage({
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        },
      ],
    }),
  ]);

  const answer = cleanAnswer(toText(response.content));

  if (!answer) throw new AnalyzeError("Gemini returned an empty answer");

  return answer;
};

/* ----------------------------- Provider chain ----------------------------- */

const PROVIDERS = { groq: analyzeWithGroq, gemini: analyzeWithGemini };

const getProviderOrder = () =>
  String(process.env.IMAGE_ANALYZER_PROVIDERS || DEFAULT_ORDER)
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name, index, all) => PROVIDERS[name] && all.indexOf(name) === index);

const analyze = async (input) => {
  const problems = [];

  for (const name of getProviderOrder()) {
    try {
      const answer = await PROVIDERS[name](input);
      console.log(`Image analysed with ${name}`);
      return answer;
    } catch (error) {
      if (error.skip) continue;

      console.warn(`Image analyzer ${name} failed: ${error.message}`);
      problems.push(`${name}: ${error.message}`);
    }
  }

  throw new AnalyzeError(problems.join(" | ") || "No image analyzer is available");
};

/* -------------------------------- The agent ------------------------------- */

export const imageAnalyzer = async (state) => {
  const filePath = state.file?.path;

  try {
    await checkAgentLimit(state.userId, "imageAnalyzer");

    if (!filePath) {
      throw new Error("No image was uploaded");
    }

    const imageBuffer = await fs.readFile(filePath);

    const answer = await analyze({
      prompt: state.prompt || "Analyze the image",
      base64: imageBuffer.toString("base64"),
      mimeType: state.file.mimetype || "image/jpeg",
      size: imageBuffer.length,
    });

    await deductCredits(state.userId, "vision");

    return {
      ...state,
      aiResponse: answer,
    };
  } catch (error) {
    // Credit (402/403/404) and rate-limit (429) errors must reach the client.
    if (error?.status && error?.data) throw error;

    console.error("Image analyzer error:", error.message);

    return {
      ...state,
      aiResponse: "Failed to analyze file",
    };
  } finally {
    // The upload is a temporary file; a failed delete must not hide the answer.
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
  }
};