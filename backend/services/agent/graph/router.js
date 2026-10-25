import { getModel } from "../config/llmModels.js";

const VALID_AGENTS = ["chat", "search", "coding", "pdf", "ppt", "vision","pdfRag","imageAnalyzer"];

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
pdf: Queries related to PDF documents, such as extracting information, summarizing content, or converting formats.
ppt: Queries related to PowerPoint presentations, including creating slides, formatting, and content suggestions.
vision: Queries related to computer vision tasks, image analysis, and visual data processing.

Return only one word: chat, search, coding, pdf, ppt or vision.

User query: ${userPrompt}`;

export const router = async (state) => {
  // A specific agent chosen in the UI is used as-is.
  if (VALID_AGENTS.includes(state.agent)) {
    return { agent: state.agent };
  }
  if(state.file.mimetype==="application/pdf"){
    return {
      ...state,
      agent: "pdfRag" 
    };
  }
  if(state.file.mimetype.startsWith("image/")){
    return {
      ...state,
      agent: "imageAnalyzer" 
    };
  }

  // "auto" (or anything unknown): let the LLM decide.
  try {
    const llm = await getModel("router");
    const response = await llm.invoke(buildPrompt(state.prompt));
    const picked = String(response.content).trim().toLowerCase();

    return {
      agent: VALID_AGENTS.find((name) => picked.includes(name)) || "chat",
    };
  } catch (error) {
    console.error("Router error:", error.message);
    return { agent: "chat" };
  }
};