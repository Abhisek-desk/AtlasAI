import api from "../../utils/axios.js";

const sendMessage = async (conversationId, content, role = "user",payload) => {
  try {
    if (!conversationId || !content?.trim()) {
      throw new Error("Conversation ID and message content are required.");
    }

    const { data } = await api.post("/api/agent/chat", {
      payload,
      conversationId,
      role,
      content: content.trim(),
    });

    return data;
  } catch (error) {
    console.error(
      "Send message error:",
      error.response?.data || error.message
    );

    throw error;
  }
};

export default sendMessage;