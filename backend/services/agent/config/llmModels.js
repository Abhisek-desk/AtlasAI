import "dotenv/config";

import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

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

export const getModel = async (agent) => {
  switch (agent) {
    case "chat":
    case "search":
    case "pdf":
    case "ppt":
    case "coding":
      return groq;

    case "vision":
      return gemini;

    default:
      return groq;
  }
};
