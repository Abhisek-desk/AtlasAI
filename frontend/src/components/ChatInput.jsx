import { useState } from "react";
import { useDispatch } from "react-redux";
import { ArrowUp, Paperclip, Mic } from "lucide-react";

import api from "../../utils/axios.js";
import { createConversation } from "../features/createConversation.js";

import {
  addConversation,
  selectConversation,
} from "../redux/conversationSlice.js";

import { addMessage, setMessageError } from "../redux/messageSlice.js";

const ChatInput = ({
  conversationId,
  disabled = false,
  sending,
  setSending,
}) => {
  const dispatch = useDispatch();
  const [message, setMessage] = useState("");

  const handleSendMessage = async ({ prompt, conversationId }) => {
    const text = prompt?.trim();
    if (!text || sending) return;

    let activeConversationId = conversationId;

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

        const conv=await createConversation()
        dispatch(selectConversation(conv))

        // Wait for the selected conversation to update before continuing.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      dispatch(
        addMessage({
          role: "user",
          content: text,
        }),
      );

      const { data } = await api.post("/api/agent/chat", {
        prompt: text,
        conversationId: activeConversationId,
      });

      console.log("Agent result:", data);

      const response =
        typeof data === "string"
          ? data
          : data?.aiResponse || data?.reply || data?.message || data?.content;

      if (response) {
        dispatch(
          addMessage({
            role: "assistant",
            content: response,
          }),
        );
      }
    } catch (err) {
      console.error("Send message error:", err.response?.data || err.message);

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

    handleSendMessage({
      prompt,
      conversationId,
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <div className="w-full px-3 pb-4 pt-2 sm:px-5 lg:px-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#171a22] shadow-lg transition focus-within:border-white/20"
      >
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message AtlasAI..."
          disabled={disabled}
          rows={1}
          className="max-h-48 min-h-14 w-full resize-none bg-transparent px-4 pt-4 text-sm text-white outline-none placeholder:text-gray-500 disabled:opacity-60"
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
