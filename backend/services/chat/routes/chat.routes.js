import express from "express";
import {
  createConversation,
  getConversations,
  updateConversation,
  deleteConversation,
  saveMessage,
  getMessages,
  createProject,
  getProjects,
  updateProject,
  deleteProject,
} from "../controllers/conversation.controller.js";

const router = express.Router();

// Conversations
router.post("/create-conversation", createConversation);
router.get("/get-conversations", getConversations);
router.put("/update-conversation", updateConversation);
router.delete("/delete-conversation/:conversationId", deleteConversation);
router.post("/save-message", saveMessage);
router.get("/get-messages/:conversationId", getMessages);

// Projects
router.post("/create-project", createProject);
router.get("/get-projects", getProjects);
router.put("/update-project", updateProject);
router.delete("/delete-project/:projectId", deleteProject);

export default router;