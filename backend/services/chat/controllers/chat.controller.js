import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

export const createConversation = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    console.log("userId", userId);
    const conversation = await Conversation.create({ userId: userId });
    return res.status(200).json({ conversation });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
};

export const getConversations = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    console.log("userId", userId);
    const conversations = await Conversation.find({ userId: userId }).sort({
      updatedAt: -1,
    });
    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
};

export const updateConversation = async (req, res) => {
  try {
    const {id,title}=req.body
    const conversations = await Conversation.findByIdAndUpdate(id,{title})
    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return res.status(500).json({ error: "Failed to update conversation" });
  }
};

export const saveMessage = async (req, res) => {
  try {
    const { conversationId, role, content } = req.body;
    const message = await Message.create({
      conversationId,
      content,
      role,
    });
  } catch (error) {
    onsole.error("Error saving conversation:", error);
    return res.status(500).json({ error: "Failed to save message" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId:req.params.conversationId,
    }).sort({
      createdAt: -1,
    });
    return res.status(200).json(messages)
  } catch (error) {
      return res.status(500).json({ message: `get message error ${error}` });
  }
};

