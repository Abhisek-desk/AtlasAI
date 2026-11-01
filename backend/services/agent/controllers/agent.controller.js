import axios from "axios";
import fs from "node:fs/promises";
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

export const agent = async (req, res, next) => {
  const file = req.file;

  // Aborted when the browser cancels the request (the Stop button).
  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) abortController.abort();
  });

  try {
    const { conversationId, agent: selectedAgent } = req.body;
    const userId = req.headers["x-user-id"];

    // A file with no question gets a sensible default instead of an error.
    const prompt =
      req.body.prompt?.trim() ||
      (file
        ? file.mimetype === "application/pdf"
          ? "Summarize this document."
          : "Describe this image."
        : "");

    if (!prompt || !conversationId) {
      return res.status(400).json({
        message: "prompt and conversationId are required",
      });
    }

    await axios.post(`${process.env.CHAT_SERVICE}/chat/save-message`, {
      conversationId,
      role: "user",
      // Remember which file the question was about.
      content: file ? `${prompt}\n\n📎 ${file.originalname}` : prompt,
    });

    const result = await graph.invoke(
      {
        prompt,
        conversationId,
        agent: selectedAgent,
        userId,
        file,
      },
      { signal: abortController.signal },
    );

    // Stopped by the user: don't save or return a reply nobody is waiting for.
    if (abortController.signal.aborted) return;

    const aiResponse = result.aiResponse;

    if (!aiResponse) {
      throw new Error("Graph completed without generating an AI response");
    }

    const images = Array.isArray(result.images) ? result.images : [];
    const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
    const files = Array.isArray(result.files) ? result.files : [];

    // Must be declared before it is used below.
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
      files,
    });

    return res.status(200).json({ aiResponse, images, artifacts, files });
  } catch (error) {
    // A stop is not an error.
    if (abortController.signal.aborted) return;

    console.error("Agent error:", error.response?.data || error.message);

    // index.js turns err.status / err.data (402, 403, 429) into the HTTP
    // response and returns 500 for everything else.
    return next(error);
  } finally {
    // Uploads are temporary; the agents delete them too, so ignore "not found".
    if (file?.path) {
      fs.unlink(file.path).catch(() => {});
    }
  }
};