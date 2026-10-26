import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { getModel } from "../config/llmModels.js";
import { getMemory } from "../config/memory.js";
import deductCredits from "../utils/deductCredits.js";

// Only send the text results to the LLM (not image URLs or metadata).
const formatSearchContext = (searchResults) => {
  const items = Array.isArray(searchResults?.results)
    ? searchResults.results
    : [];

  if (items.length === 0) return "";

  return items
    .map(
      (item, index) =>
        `[${index + 1}] ${item.title}\nURL: ${item.url}\n${item.content}`,
    )
    .join("\n\n");
};

export const chatAgent = async (state) => {
  const llm = await getModel("chat");

  const history = await getMemory(state.conversationId);

  let systemPrompt =
    "You are AtlasAI, a helpful assistant. Provide accurate, clear, and useful answers.";

  const searchContext = formatSearchContext(state.searchResults);

  if (searchContext) {
    systemPrompt +=
      "\n\nUse the following real-time web search results to answer. " +
      "Prefer them over your own knowledge for current information and " +
      "mention source URLs when useful.\n\n" +
      searchContext;
  }

  const messages = [new SystemMessage(systemPrompt)];

  for (const msg of history) {
    if (msg.role === "user") {
      messages.push(new HumanMessage(msg.content));
    } else if (msg.role === "assistant") {
      messages.push(new AIMessage(msg.content));
    }
  }

  // The controller stores the current prompt in history only after the graph
  // runs, so add it here unless it is already the last user message.
  const lastMessage = history[history.length - 1];

  if (
    !lastMessage ||
    lastMessage.role !== "user" ||
    lastMessage.content !== state.prompt
  ) {
    messages.push(new HumanMessage(state.prompt));
  }

  const response = await llm.invoke(messages);
  await deductCredits(state.userId,"chat")

  return { aiResponse: response.content };
};