import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: String,
    content: String,
  },
  {
    _id: false,
  },
);

const artifactSchema = new mongoose.Schema(
  {
    id: Number,
    type: String,
    title: String,
    files: [fileSchema],
  },
  {
    _id: false,
  },
);

// A generated PDF, slide deck or image stored in Cloudinary (or locally).
const storedFileSchema = new mongoose.Schema(
  {
    name: String,
    url: String,
    type: String,
    bytes: Number,
    provider: String,
    publicId: String,
    expiresInSeconds: Number,
  },
  {
    _id: false,
  },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
    },
    content: String,
    images: [String],
    artifacts: [artifactSchema],
    files: [storedFileSchema],
  },
  { timestamps: true },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;