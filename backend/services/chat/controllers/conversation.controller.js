import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

// Create a new conversation
export const createConversation = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];

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
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({ message: "User ID is missing" });
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
    const { id, title } = req.body;

    if (!id || !title) {
      return res.status(400).json({
        message: "Conversation ID and title are required",
      });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      id,
      { title },
      { new: true, runValidators: true },
    );

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    return res.status(200).json({ conversation });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return res.status(500).json({
      message: "Failed to update conversation",
    });
  }
};

// Save a message
export const saveMessage = async (req, res) => {
  try {
    const { conversationId, role, content } = req.body;

    if (!conversationId || !role || !content) {
      return res.status(400).json({
        message: "conversationId, role, and content are required",
      });
    }

    const message = await Message.create({
      conversationId,
      role,
      content,
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
    const { conversationId } = req.params;

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
