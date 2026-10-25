import axios from "axios";
import { graph } from "../graph/graph.js";
import { addMessage } from "../config/memory.js";

// Generated files are not part of the chat text, so add them to the
// conversation memory. Otherwise follow-ups ("make the button red") can't
// see the code that was generated earlier.
const withArtifactFiles = (text, artifacts) => {
  const files = artifacts.flatMap((artifact) =>
    Array.isArray(artifact?.files) ? artifact.files : [],
  );

  if (files.length === 0) return text;

  const fileText = files
    .map((file) => `File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\``)
    .join("\n\n");

  return `${text}\n\n${fileText}`;
};

export const agent = async (req, res) => {
  try {
    const { prompt, conversationId, agent: selectedAgent } = req.body;
    const userId=req.headers["x-user-id"]
    const file=req.file

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

    const result = await graph.invoke({
      prompt,
      conversationId,
      agent: selectedAgent,
      userId,
      file
    });

    const aiResponse = result.aiResponse;

    if (!aiResponse) {
      throw new Error("Graph completed without generating an AI response");
    }

    const images = Array.isArray(result.images) ? result.images : [];
    const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];

    const responseText =
      typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse);

    await addMessage(conversationId, "user", prompt);
    await addMessage(
      conversationId,
      "assistant",
      withArtifactFiles(responseText, artifacts),
    );

    await axios.post(`${process.env.CHAT_SERVICE}/chat/save-message`, {
      conversationId,
      role: "assistant",
      content: responseText,
      images,
      artifacts,
    });

    return res.status(200).json({ aiResponse, images, artifacts });
  } catch (error) {
    console.error("Agent error:", error.response?.data || error.message);

    return res.status(500).json({
      message: "Agent error",
      error: error.response?.data || error.message,
    });
  }
};