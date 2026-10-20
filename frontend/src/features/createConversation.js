
import api from "../../utils/axios.js";

export const createConversation = async () => {
  try {
    const { data } = await api.post("/api/chat/create-conversation");

    return data.conversation;
  } catch (error) {
    console.error(
      "Create conversation error:",
      error.response?.data || error.message,
    );

    return null;
  }
};