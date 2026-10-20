import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";

import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import Nav from "./Nav";

import { createConversation } from "../features/createConversation.js";
import getMessages from "../features/getMessages.js";

import {
  addConversation,
  selectConversation,
} from "../redux/conversationSlice.js";

import {
  setMessages,
  clearMessages,
  setMessageLoading,
  setMessageError,
} from "../redux/messageSlice.js";

const ChatArea = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { conversationId } = useParams();

  const { conversations, selectedConversation } = useSelector(
    (state) => state.conversation,
  );

  const { messages, loading, error } = useSelector(
    (state) => state.message,
  );

  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      if (selectedConversation) {
        dispatch(clearMessages());
      }
      return;
    }

    const conversation = conversations.find(
      (item) => item._id === conversationId,
    );

    if (conversation && selectedConversation?._id !== conversationId) {
      dispatch(selectConversation(conversation));
    }
  }, [
    conversationId,
    conversations,
    selectedConversation,
    dispatch,
  ]);

  useEffect(() => {
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
  }, [conversationId, dispatch]);

  const handleNewChat = async () => {
    try {
      dispatch(clearMessages());
      dispatch(setMessageError(null));

      const conversation = await createConversation();

      if (!conversation?._id) {
        dispatch(setMessageError("Failed to create a new conversation."));
        return;
      }

      dispatch(addConversation(conversation));
      dispatch(selectConversation(conversation));

      navigate(`/chat/${conversation._id}`);
    } catch (err) {
      console.error("Create conversation error:", err);
      dispatch(setMessageError("Failed to create a new conversation."));
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
        conversationId={conversationId || selectedConversation?._id}
        disabled={loading || sending}
        sending={sending}
        setSending={setSending}
      />
    </main>
  );
};

export default ChatArea;