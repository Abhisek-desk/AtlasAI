import api from "../../utils/axios";

export const getConversations = async () => {
  try {
    const { data } = await api.get("/api/chat/get-conversations");
    return Array.isArray(data.conversations) ? data.conversations : [];
  } catch (error) {
    console.error("Get conversations error:", error.response?.data || error.message);
    return [];
  }
};