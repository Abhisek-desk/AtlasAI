import express from "express";
import {
  createConversation,
  getConversations,
  updateConversation,
  saveMessage,
  getMessages,
} from "../controllers/conversation.controller.js";

const router = express.Router();

router.post("/create-conversation", createConversation);
router.get("/get-conversations", getConversations);
router.put("/update-conversation", updateConversation);
router.post("/save-message", saveMessage);
router.get("/messages/:conversationId", getMessages);

export default router;
