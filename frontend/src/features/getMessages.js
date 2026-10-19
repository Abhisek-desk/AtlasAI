import api from "../../utils/axios.js";

const getMessages = async (id) => {
  if (!id) return [];

  try {
    const { data } = await api.get(
      `/api/chat/get-messages/${id}`
    );

    return Array.isArray(data.messages) ? data.messages : [];
  } catch (error) {
    console.error(
      "Get messages error:",
      error.response?.status,
      error.response?.data || error.message
    );

    return [];
  }
};

export default getMessages;