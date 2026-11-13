import axios from "axios";

// Loads a conversation's recent history from the chat service, as the
// [{ role, content }] list the agents use as memory. Returns null on failure.
const getMessages = async (conversationId) => {
  try {
    const { data } = await axios.get(
      `${process.env.CHAT_SERVICE}/chat/get-messages/${conversationId}`,
      { headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET } },
    );

    if (!Array.isArray(data?.messages)) return null;

    const history = data.messages.map(({ role, content }) => ({
      role,
      content,
    }));

    // The question being answered right now is already saved in the database,
    // but the agent adds it itself, so leave it out of the history.
    if (history.length > 0 && history[history.length - 1].role === "user") {
      history.pop();
    }

    return history.slice(-20);
  } catch (error) {
    console.log("Load history error:", error.message);
    return null;
  }
};

export default getMessages;