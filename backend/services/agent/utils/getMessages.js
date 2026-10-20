import axios from "axios";


const getMessages =async (conversationId) => {
  try {
    const {data}=await axios.post(`${process.env.CHAT_SERVICE}/chat/get-messages/${conversationId}`);
    return data
  } catch (error) {
    console.log(error)
    return null
  }
}

export default getMessages