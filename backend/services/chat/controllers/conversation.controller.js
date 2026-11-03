import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

// The gateway verifies the session and sends the user's ID in this header.
const getUserId = (req) => req.headers["x-user-id"];

// Returns the conversation only if it belongs to this user, otherwise null.
const findOwnedConversation = async (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) return null;

  const conversation = await Conversation.findById(conversationId);

  if (!conversation || String(conversation.userId) !== String(userId)) {
    return null;
  }

  return conversation;
};

// Create a new conversation
export const createConversation = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "User ID is missing" });
    }

    const conversation = await Conversation.create({ userId });

    return res.status(201).json({ conversation });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return res.status(500).json({
      message: "Failed to create conversation",
    });
  }
};

// Get all conversations belonging to the logged-in user
export const getConversations = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const conversations = await Conversation.find({ userId }).sort({
      updatedAt: -1,
    });

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);

    return res.status(500).json({
      message: "Failed to fetch conversations",
    });
  }
};

// Update a conversation title
export const updateConversation = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { conversationId, title } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!conversationId || !title) {
      return res.status(400).json({
        message: "Conversation ID and title are required",
      });
    }

    const owned = await findOwnedConversation(conversationId, userId);

    if (!owned) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      { title },
      { new: true, runValidators: true },
    );

    return res.status(200).json({ conversation });
  } catch (error) {
    console.error("Error updating conversation:", error);

    return res.status(500).json({
      message: "Failed to update conversation",
    });
  }
};

// Save a message. The agent service calls this internally (no user header),
// so it is not tied to the logged-in user.
export const saveMessage = async (req, res) => {
  try {
    const { conversationId, role, content, images, artifacts, files } =
      req.body;

    if (!conversationId || !role || !content) {
      return res.status(400).json({
        message: "conversationId, role, and content are required",
      });
    }

    const message = await Message.create({
      conversationId,
      role,
      content,
      images: Array.isArray(images) ? images : [],
      artifacts: Array.isArray(artifacts) ? artifacts : [],
      files: Array.isArray(files) ? files : [],
    });

    // Update the conversation's updatedAt timestamp
    await Conversation.findByIdAndUpdate(conversationId, {
      updatedAt: new Date(),
    });

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Error saving message:", error);
    return res.status(500).json({
      message: "Failed to save message",
    });
  }
};

// Get all messages for a conversation
export const getMessages = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { conversationId } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const owned = await findOwnedConversation(conversationId, userId);

    if (!owned) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({
      message: "Failed to fetch messages",
    });
  }
};