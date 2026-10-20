import axios from "axios";
import { graph } from "../graph/graph.js";
import { addMessage } from "../config/memory.js";
import redis from "../../../shared/redis/redis.js";

export const agent = async (req, res) => {
  try {
    const { prompt, conversationId } = req.body;

    console.log("Request body:", req.body);

    if (!prompt || !conversationId) {
      return res.status(400).json({
        message: "prompt and conversationId are required",
      });
    }

    await axios.post(`${process.env.CHAT_SERVICE}/chat/save-message`, {
      conversationId,
      role: "user",
      content: prompt,
    });

    console.log("Invoking graph...");

    const result = await graph.invoke({
      prompt,
      conversationId,
    });

    // console.log("Graph result:", result);

    const aiResponse = result.aiResponse;

    if (!aiResponse) {
      throw new Error("Graph completed without generating an AI response");
    }

    await addMessage(conversationId,"user",prompt)

    await addMessage(conversationId,"assistant",aiResponse)

    await axios.post(`${process.env.CHAT_SERVICE}/chat/save-message`, {
      conversationId,
      role: "assistant",
      content:
        typeof aiResponse === "string"
          ? aiResponse
          : JSON.stringify(aiResponse),
    });

    return res.status(200).json({ aiResponse });
  } catch (error) {
    console.error("Agent error:", error.response?.data || error.message);
    return res.status(500).json({
      message: "Agent error",
      error: error.response?.data || error.message,
    });
  }
};
