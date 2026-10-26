import { getModel } from "../config/llmModels.js";

// Agents a user (or an attached file) can pick directly.
const VALID_AGENTS = ["chat", "search", "coding", "pdf", "ppt", "vision","pdfRag","imageAnalyzer"];

// Agents the LLM router is allowed to choose in "auto" mode.
const ROUTABLE_AGENTS = ["chat", "search", "coding", "pdf", "ppt", "vision"];

const buildPrompt = (userPrompt) => `You are a router agent that routes the user query to the appropriate agent based on the query.
You have the following agents available:
- chat
- search
- coding
- pdf
- ppt
- vision

Rules for routing:
chat: General queries, casual conversation, and questions that do not fit into the other categories.
search: Current events, news, or information that requires up-to-date knowledge.
coding: General programming questions, code generation, debugging, and technical queries related to software development.
pdf: Requests to create, write or generate a PDF document, report or guide on a topic.
ppt: Requests to create or make a PowerPoint presentation or slides on a topic.
vision: Requests to generate, draw or create an image, picture, illustration or artwork.

Return only one word: chat, search, coding, pdf, ppt or vision.

User query: ${userPrompt}`;

export const router = async (state) => {
  // An attached file always goes to the agent that can read it. `state.file`
  // is undefined for plain text messages, so it must be checked first.
  const mimetype = state.file?.mimetype || "";

  if (mimetype === "application/pdf") {
    return { agent: "pdfRag" };
  }

  if (mimetype.startsWith("image/")) {
    return { agent: "imageAnalyzer" };
  }

  // A specific agent chosen in the UI is used as-is.
  if (VALID_AGENTS.includes(state.agent)) {
    return { agent: state.agent };
  }

  // "auto" (or anything unknown): let the LLM decide.
  try {
    const llm = await getModel("router");
    const response = await llm.invoke(buildPrompt(state.prompt));
    const picked = String(response.content).trim().toLowerCase();

    return {
      agent: ROUTABLE_AGENTS.find((name) => picked.includes(name)) || "chat",
    };
  } catch (error) {
    console.error("Router error:", error.message);
    return { agent: "chat" };
  }
};