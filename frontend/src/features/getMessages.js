import api from "../../utils/axios.js";

const getMessages = async (conversationId) => {
  try {
    const { data } = await api.get(
      `/api/chat/get-messages/${conversationId}`
    );

    return Array.isArray(data) ? data : data.messages || [];
  } catch (error) {
    console.error(
      "Get messages error:",
      error.response?.data || error.message
    );

    throw error;
  }
};

export default getMessages;