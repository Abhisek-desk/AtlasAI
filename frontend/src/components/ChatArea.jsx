import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import Nav from "./Nav";

import api from "../../utils/axios.js";
import { createConversation } from "../features/createConversation.js";
import getMessages from "../features/getMessages.js";

import {
  addConversation,
  selectConversation,
} from "../redux/conversationSlice.js";

import {
  setMessages,
  addMessage,
  clearMessages,
  setMessageLoading,
  setMessageError,
} from "../redux/messageSlice.js";

const ChatArea = () => {
  const dispatch = useDispatch();

  const { selectedConversation } = useSelector(
    (state) => state.conversation
  );

  const { messages, loading, error } = useSelector(
    (state) => state.message
  );

  const [sending, setSending] = useState(false);

  useEffect(() => {
    const conversationId = selectedConversation?._id;

    if (!conversationId) {
      dispatch(clearMessages());
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        dispatch(setMessageLoading(true));
        dispatch(setMessageError(null));

        const data = await getMessages(conversationId);

        if (!cancelled) {
          dispatch(setMessages(Array.isArray(data) ? data : []));
        }
      } catch (err) {
        console.error("Fetch messages error:", err);

        if (!cancelled) {
          dispatch(setMessages([]));
          dispatch(setMessageError("Failed to load messages."));
        }
      } finally {
        if (!cancelled) {
          dispatch(setMessageLoading(false));
        }
      }
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedConversation, dispatch]);

  const handleNewChat = async () => {
    try {
      dispatch(clearMessages());
      dispatch(setMessageError(null));

      const conversation = await createConversation();

      if (!conversation) {
        dispatch(setMessageError("Failed to create a new conversation."));
        return;
      }

      dispatch(addConversation(conversation));
      dispatch(selectConversation(conversation));
    } catch (err) {
      console.error("Create conversation error:", err);
      dispatch(setMessageError("Failed to create a new conversation."));
    }
  };

  const handleSendMessage = async ({ prompt, conversationId }) => {
    const text = prompt?.trim();
    if (!text || sending) return;

    let activeConversationId =
      conversationId || selectedConversation?._id;

    try {
      setSending(true);
      dispatch(setMessageError(null));

      if (!activeConversationId) {
        const conversation = await createConversation();

        if (!conversation) {
          dispatch(setMessageError("Failed to create a conversation."));
          return;
        }

        dispatch(addConversation(conversation));
        dispatch(selectConversation(conversation));

        activeConversationId = conversation._id;
      }

      dispatch(
        addMessage({
          role: "user",
          content: text,
        })
      );

      const { data } = await api.post("/api/agent/chat", {
        prompt: text,
        conversationId: activeConversationId,
      });

      const response =
        typeof data === "string"
          ? data
          : data?.aiResponse || data?.reply || data?.message || data?.content;

      if (response) {
        dispatch(
          addMessage({
            role: "assistant",
            content: response,
          })
        );
      }
    } catch (err) {
      console.error(
        "Send message error:",
        err.response?.data || err.message
      );

      dispatch(setMessageError("Failed to send message."));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0d0f14] text-white">
      <Nav onNewChat={handleNewChat} />

      <MessageList
        messages={messages}
        loading={loading}
        sending={sending}
        error={error}
        onNewChat={handleNewChat}
      />

      <ChatInput
        onSend={handleSendMessage}
        conversationId={selectedConversation?._id}
        disabled={loading || sending}
      />
    </main>
  );
};

export default ChatArea;