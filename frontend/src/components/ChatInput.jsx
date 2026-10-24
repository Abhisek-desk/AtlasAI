import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  ArrowUp,
  Paperclip,
  Mic,
  Sparkles,
  MessageSquare,
  Code,
  FileText,
  Presentation,
  Image as ImageIcon,
  Globe,
} from "lucide-react";

import api from "../../utils/axios.js";
import { createConversation } from "../features/createConversation.js";

import {
  addConversation,
  updateConversation,
} from "../redux/conversationSlice.js";

import {
  addMessage,
  setArtifacts,
  setMessageError,
} from "../redux/messageSlice.js";

const DEFAULT_TITLE = "New Chat";

const AGENTS = [
  { id: "auto", label: "Auto", icon: Sparkles },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "coding", label: "Coding", icon: Code },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "ppt", label: "PPT", icon: Presentation },
  { id: "vision", label: "vision", icon: ImageIcon },
  { id: "search", label: "Search", icon: Globe },
];

const ChatInput = ({
  conversationId,
  disabled = false,
  sending,
  setSending,
  initialValue = "",
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const currentTitle = useSelector(
    (state) => state.conversation.selectedConversation?.title,
  );

  const [message, setMessage] = useState(initialValue);
  const [selectedAgent, setSelectedAgent] = useState("auto");

  const handleSendMessage = async ({ prompt, conversationId }) => {
    const text = prompt?.trim();

    if (!text || sending) return;

    let activeConversationId = conversationId;
    let createdNow = false;

    try {
      setSending(true);
      dispatch(setMessageError(null));

      if (!activeConversationId) {
        const conversation = await createConversation();

        if (!conversation?._id) {
          dispatch(setMessageError("Failed to create a conversation."));
          return;
        }

        activeConversationId = conversation._id;
        createdNow = true;

        // addConversation already selects the new conversation.
        dispatch(addConversation(conversation));
      }

      dispatch(addMessage({ role: "user", content: text }));

      const { data } = await api.post("/api/agent/chat", {
        prompt: text,
        conversationId: activeConversationId,
        agent: selectedAgent,
      });

      const response =
        typeof data === "string"
          ? data
          : data?.aiResponse ||
            data?.answer ||
            data?.reply ||
            data?.message ||
            data?.content;

      const images = Array.isArray(data?.images) ? data.images : [];
      const artifacts = Array.isArray(data?.artifacts) ? data.artifacts : [];

      // Keep the current project open when a reply has no artifacts
      // (a normal chat answer should not close the panel).
      if (artifacts.length > 0) {
        dispatch(setArtifacts(artifacts));
      }

      if (response) {
        dispatch(
          addMessage({ role: "assistant", content: response, images, artifacts }),
        );
      }

      // Name the conversation from its first prompt only.
      if (createdNow || !currentTitle || currentTitle === DEFAULT_TITLE) {
        const title = text.slice(0, 40);

        dispatch(updateConversation({ _id: activeConversationId, title }));

        try {
          await api.put("/api/chat/update-conversation", {
            conversationId: activeConversationId,
            title,
          });
        } catch (titleError) {
          console.error(
            "Update title error:",
            titleError.response?.data || titleError.message,
          );
        }
      }

      // Put the new conversation in the URL so a refresh keeps it.
      if (createdNow) {
        navigate(`/chat/${activeConversationId}`, { replace: true });
      }
    } catch (error) {
      console.error(
        "Send message error:",
        error.response?.data || error.message,
      );

      dispatch(setMessageError("Failed to send message."));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const prompt = message.trim();

    if (!prompt || disabled || sending) return;

    setMessage("");

    handleSendMessage({ prompt, conversationId });
  };

  const handleKeyDown = (event) => {
    // Ignore Enter while an IME composition is in progress.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      handleSubmit(event);
    }
  };

  return (
    <div className="w-full px-3 pb-4 pt-2 sm:px-5 lg:px-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#171a22] shadow-lg transition focus-within:border-white/20"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const isSelected = selectedAgent === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedAgent(agent.id)}
                aria-pressed={isSelected}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? "bg-purple-600 text-white shadow"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={14} />
                <span>{agent.label}</span>
              </button>
            );
          })}
        </div>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message AtlasAI..."
          disabled={disabled}
          rows={1}
          autoFocus={Boolean(initialValue)}
          className="max-h-48 min-h-14 w-full resize-none bg-transparent px-4 pt-2 text-sm text-white outline-none placeholder:text-gray-500 disabled:opacity-60"
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Attach file"
              disabled={disabled}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>

            <button
              type="button"
              title="Voice input"
              disabled={disabled}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <Mic size={18} />
            </button>

            <span className="hidden text-xs text-gray-500 sm:inline">
              Shift + Enter for a new line
            </span>
          </div>

          <button
            type="submit"
            disabled={!message.trim() || disabled || sending}
            title="Send message"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
          >
            <ArrowUp size={19} />
          </button>
        </div>
      </form>

      <p className="mx-auto mt-3 max-w-4xl text-center text-[11px] text-gray-500">
        AtlasAI can make mistakes. Verify important information.
      </p>
    </div>
  );
};

export default ChatInput;