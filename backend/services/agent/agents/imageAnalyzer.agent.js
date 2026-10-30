import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import fs from "fs/promises";
import deductCredits from "../utils/deductCredits.js";
import { checkAgentLimit } from "../config/agentlimit.js";

const toText = (content) => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("");
  }

  return String(content ?? "");
};

export const imageAnalyzer = async (state) => {
  const filePath = state.file?.path;

  try {
    await checkAgentLimit(state.userId,"imageAnalyzer")
    if (!filePath) {
      throw new Error("No image was uploaded");
    }

    const llm = await getModel("imageAnalyzer");
    // readFile returns a Promise: without `await` the "image" was the text
    // "[object Promise]" encoded as base64.
    const imageBuffer = await fs.readFile(filePath);
    const base64Image = imageBuffer.toString("base64");
    const messages = [
      new SystemMessage(`You are image Analyzer agent.
        Rules:
          - Analyze only the upload image.
          - Answer the user's question accurately.
          - If text exists in the image, extract it.
          - if charts and tables exist, explain them.
          - Use Markdown when helpful.
          - Do not hallucinate.
          `),
      new HumanMessage({
        content: [
          {
            type: "text",
            text: state.prompt || "analyze the image",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${state.file.mimetype};base64,${base64Image}`,
            },
          },
        ],
      }),
    ];
    const response = await llm.invoke(messages);
    await deductCredits(state.userId,"vision")
    return {
      ...state,
      aiResponse: toText(response.content),
    };
  } catch (error) {
    console.log(error);
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