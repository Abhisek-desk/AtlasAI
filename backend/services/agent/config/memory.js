import redis from "../../../shared/redis/redis.js";
import getMessages from "../utils/getMessages.js";

export const getMemory = async (conversationId) => {
  const key = `messages-${conversationId}`;
  const cached = await redis.get(key);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error("Invalid Redis conversation history:", error);
    }
  }

  const messages = await getMessages(conversationId);
  if (!Array.isArray(messages)) {
    return [];
  }

  const history = messages;

  await redis.set(key, JSON.stringify(history), "EX", 24 * 60 * 60);

  return history;
};

export const addMessage = async (conversationId, role, content) => {
  const key = `messages-${conversationId}`;
  const messages = await getMemory(conversationId);

  // Defensive check: ensure messages is always an array.
  const history = Array.isArray(messages) ? messages : [];

  const last = history[history.length - 1];

  if (!(last && last.role === role && last.content === content)) {
    history.push({ role, content });
  }

  // Keep only the latest 20 messages.
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  await redis.set(key, JSON.stringify(history), "EX", 24 * 60 * 60);

  return history;
};
