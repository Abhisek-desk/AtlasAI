import "dotenv/config";

import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";

const groq = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
  maxRetries: 2,
});

const gemini = new ChatGoogleGenerativeAI({
  model: "gemini-3.8-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
  maxRetries: 2,
});

const openrouter = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature: 0,
  maxTokens: undefined,
  // other params...
});

export const getModel = async (agent) => {
  switch (agent) {
    case "chat":
    case "search":
    case "pdf":
    case "ppt":
      return groq;
    case "coding":
      return openrouter;

    case "vision":
      return gemini;

    default:
      return groq;
  }
};
