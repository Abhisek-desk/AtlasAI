import { timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import Project from "../models/project.model.js";

const MAX_TITLE_LENGTH = 80;
const MAX_PROJECT_NAME_LENGTH = 60;
const MAX_PROJECTS_PER_USER = 50;

// The gateway verifies the session and sends the user's ID in this header.
const getUserId = (req) => req.headers["x-user-id"];

// The agent service reads chat history on behalf of a user, so it proves who
// it is with the secret shared between the services instead of a user ID.
const isInternalRequest = (req) => {
  const secret = process.env.INTERNAL_API_SECRET;
  const sent = req.headers["x-internal-secret"];

  if (!secret || typeof sent !== "string") return false;

  const a = Buffer.from(sent);
  const b = Buffer.from(secret);

  return a.length === b.length && timingSafeEqual(a, b);
};

// Collapses whitespace and limits the length of a user-typed name.
const cleanText = (value, maxLength) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

// Returns the conversation only if it belongs to this user, otherwise null.
const findOwnedConversation = async (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) return null;

  const conversation = await Conversation.findById(conversationId);

  if (!conversation || String(conversation.userId) !== String(userId)) {
    return null;
  }

  return conversation;
};

// Returns the project only if it belongs to this user, otherwise null.
const findOwnedProject = async (projectId, userId) => {
  if (!mongoose.isValidObjectId(projectId)) return null;

  const project = await Project.findById(projectId);

  if (!project || String(project.userId) !== String(userId)) {
    return null;
  }

  return project;
};

/* -------------------------------------------------------------------------- */
/*  Conversations                                                             */
/* -------------------------------------------------------------------------- */

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

// Change a conversation: rename it, pin/unpin it, or move it to a project.
// Send conversationId plus any of: title, pinned, projectId (null = remove
// from its project).
export const updateConversation = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { conversationId, title, pinned, projectId } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        message: "Conversation ID is required",
      });
    }

    const owned = await findOwnedConversation(conversationId, userId);

    if (!owned) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const update = {};

    if (title !== undefined) {
      const cleanTitle = cleanText(title, MAX_TITLE_LENGTH);

      if (!cleanTitle) {
        return res.status(400).json({ message: "Title cannot be empty" });
      }

      update.title = cleanTitle;
    }

    if (pinned !== undefined) {
      if (typeof pinned !== "boolean") {
        return res.status(400).json({ message: "pinned must be true or false" });
      }

      update.pinned = pinned;
    }

    if (projectId !== undefined) {
      if (projectId === null) {
        update.projectId = null;
      } else {
        const project = await findOwnedProject(projectId, userId);

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        update.projectId = project._id;
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    // timestamps: false keeps the chat where it is in the list.
    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      update,
      { new: true, runValidators: true, timestamps: false },
    );

    return res.status(200).json({ conversation });
  } catch (error) {
    console.error("Error updating conversation:", error);

    return res.status(500).json({
      message: "Failed to update conversation",
    });
  }
};

// Delete a conversation and all of its messages
export const deleteConversation = async (req, res) => {
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

    await Message.deleteMany({ conversationId: owned._id });
    await Conversation.findByIdAndDelete(owned._id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);

    return res.status(500).json({
      message: "Failed to delete conversation",
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

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    // Internal calls (the agent service) are trusted; everyone else may only
    // read their own conversations.
    if (!isInternalRequest(req)) {
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

/* -------------------------------------------------------------------------- */
/*  Projects                                                                  */
/* -------------------------------------------------------------------------- */

// Create a project
export const createProject = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const name = cleanText(req.body.name, MAX_PROJECT_NAME_LENGTH);

    if (!name) {
      return res.status(400).json({ message: "Project name is required" });
    }

    const count = await Project.countDocuments({ userId });

    if (count >= MAX_PROJECTS_PER_USER) {
      return res.status(400).json({
        message: `You can have up to ${MAX_PROJECTS_PER_USER} projects`,
      });
    }

    const project = await Project.create({ userId, name });

    return res.status(201).json({ project });
  } catch (error) {
    console.error("Error creating project:", error);
    return res.status(500).json({ message: "Failed to create project" });
  }
};

// Get all projects of the logged-in user (newest first)
export const getProjects = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const projects = await Project.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ message: "Failed to fetch projects" });
  }
};

// Rename a project
export const updateProject = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { projectId } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const name = cleanText(req.body.name, MAX_PROJECT_NAME_LENGTH);

    if (!projectId || !name) {
      return res.status(400).json({
        message: "Project ID and name are required",
      });
    }

    const owned = await findOwnedProject(projectId, userId);

    if (!owned) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = await Project.findByIdAndUpdate(
      owned._id,
      { name },
      { new: true, runValidators: true },
    );

    return res.status(200).json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return res.status(500).json({ message: "Failed to update project" });
  }
};

// Delete a project. Its chats are kept and just leave the project.
export const deleteProject = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const owned = await findOwnedProject(projectId, userId);

    if (!owned) {
      return res.status(404).json({ message: "Project not found" });
    }

    await Conversation.updateMany(
      { userId, projectId: owned._id },
      { projectId: null },
      { timestamps: false },
    );

    await Project.findByIdAndDelete(owned._id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return res.status(500).json({ message: "Failed to delete project" });
  }
};