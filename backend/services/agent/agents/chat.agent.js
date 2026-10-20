import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { getModel } from "../config/llmModels.js";
import { getMemory } from "../config/memory.js";

export const chatAgent = async (state) => {
  const llm = await getModel("chat");

  const history = await getMemory(state.conversationId);

  const searchContext = state.searchResults
    ? `Web Search Results 
  ${JSON.stringify(state.searchResults)}
   Answer the user using only the above results`
    : "";

  const systemPrompt = `You are AtlasAI, a helpful assistant.Provide accurate, clear, and useful answers.
  ${searchContext} 
  If searchContext exists:
  - Use search results to answer
  - Do not mention internal errors`;

  const messages = [new SystemMessage(systemPrompt)];

  // The current prompt is already stored in history by the controller.
  // Convert the saved messages into LangChain message objects.
  for (const msg of history) {
    if (msg.role === "user") {
      messages.push(new HumanMessage(msg.content));
    } else if (msg.role === "assistant") {
      messages.push(new AIMessage(msg.content));
    }
  }

  // Add the current prompt only if it isn't already the last user message.
  const lastMessage = history[history.length - 1];

  if (
    !lastMessage ||
    lastMessage.role !== "user" ||
    lastMessage.content !== state.prompt
  ) {
    messages.push(new HumanMessage(state.prompt));
  }

  const response = await llm.invoke(messages);

  return {
    ...state,
    aiResponse: response.content,
  };
};
