import mongoose from "mongoose";

const conversationSchema = mongoose.Schema(
  {
    title: {
      type: String,
      default: "New Chat",
    },
    userId: {
      type: String,
    },
    // Pinned chats are listed under "Pinned chats" in the sidebar.
    pinned: {
      type: Boolean,
      default: false,
    },
    // The project this chat was added to (null = not in a project).
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
  },
  { timestamps: true },
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;