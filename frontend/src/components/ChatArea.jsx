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
  setArtifacts,
} from "../redux/messageSlice.js";

const ChatArea = (onOpenSidebar) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { conversationId } = useParams();

  const { conversations, selectedConversation } = useSelector(
    (state) => state.conversation,
  );

  const { messages, loading, error } = useSelector((state) => state.message);

  const [sending, setSending] = useState(false);
  // Suggestion chips pre-fill the input; `key` remounts it with the new text.
  const [draft, setDraft] = useState({ key: 0, text: "" });

  // Keep the selected conversation in sync with the URL.
  useEffect(() => {
    if (!conversationId) return;

    const conversation = conversations.find(
      (item) => item._id === conversationId,
    );

    if (conversation && selectedConversation?._id !== conversationId) {
      dispatch(selectConversation(conversation));
    }
  }, [conversationId, conversations, selectedConversation?._id, dispatch]);

  // Load messages only when the URL conversation changes.
  useEffect(() => {
    if (!conversationId) {
      // Also clears the artifact panel.
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
          const list = Array.isArray(data) ? data : [];

          dispatch(setMessages(list));

          // Show the most recent generated project, if this chat has one.
          const latestArtifactMessage = [...list]
            .reverse()
            .find(
              (msg) => Array.isArray(msg.artifacts) && msg.artifacts.length > 0,
            );

          dispatch(setArtifacts(latestArtifactMessage?.artifacts || []));
        }
      } catch (err) {
        console.error("Fetch messages error:", err);

        if (!cancelled) {
          dispatch(setMessages([]));
          dispatch(setMessageError("Failed to load messages."));
          dispatch(setArtifacts([]));
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

      const conversation = await createConversation();

      if (!conversation?._id) {
        dispatch(setMessageError("Failed to create a new conversation."));
        return;
      }

      // addConversation already selects the new conversation.
      dispatch(addConversation(conversation));

      navigate(`/chat/${conversation._id}`);
    } catch (err) {
      console.error("Create conversation error:", err);
      dispatch(setMessageError("Failed to create a new conversation."));
    }
  };

  const handleSuggestion = (text) => {
    setDraft((prev) => ({ key: prev.key + 1, text }));
  };

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0d0f14] text-white">
      <Nav onNewChat={handleNewChat} onMenuClick={onOpenSidebar} />

      <MessageList
        messages={messages}
        loading={loading}
        sending={sending}
        error={error}
        onSuggestionClick={handleSuggestion}
      />

      <ChatInput
        key={draft.key}
        initialValue={draft.text}
        conversationId={conversationId || selectedConversation?._id}
        disabled={loading || sending}
        sending={sending}
        setSending={setSending}
      />
    </main>
  );
};

export default ChatArea;
