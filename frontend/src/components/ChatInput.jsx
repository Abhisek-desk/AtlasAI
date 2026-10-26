import { useEffect, useRef, useState } from "react";
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
  X,
} from "lucide-react";

import api from "../../utils/axios.js";
import { createConversation } from "../features/createConversation.js";
import { getCurrentUser } from "../features/getCurrentUser.js";

import {
  addConversation,
  updateConversation,
} from "../redux/conversationSlice.js";

import {
  addMessage,
  setArtifacts,
  setMessageError,
} from "../redux/messageSlice.js";
import { setUserData } from "../redux/userSlice.js";

const DEFAULT_TITLE = "New Chat";

// Same limit as the upload middleware on the server.
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TEXTAREA_HEIGHT = 192;

const AGENTS = [
  { id: "auto", label: "Auto", icon: Sparkles },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "coding", label: "Coding", icon: Code },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "ppt", label: "PPT", icon: Presentation },
  { id: "vision", label: "vision", icon: ImageIcon },
  { id: "search", label: "Search", icon: Globe },
];

const isPdfFile = (file) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Used when a file is attached but nothing was typed.
const defaultPromptFor = (file) =>
  isPdfFile(file) ? "Summarize this document." : "Describe this image.";

// Phones: Enter adds a new line (the send button sends), like most chat apps.
const isTouchDevice = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(pointer: coarse)").matches);

const growTextarea = (element) => {
  if (!element) return;

  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
};

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

  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const [message, setMessage] = useState(initialValue);
  const [selectedAgent, setSelectedAgent] = useState("auto");

  // Thumbnail for image attachments. The object URL is created when a file is
  // picked and revoked when it is replaced, removed or the input unmounts.
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewUrlRef = useRef(null);

  const replacePreview = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    previewUrlRef.current = file?.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : null;

    setPreviewUrl(previewUrlRef.current);
  };

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  // A prefilled suggestion can be several lines long.
  useEffect(() => {
    growTextarea(textareaRef.current);
  }, []);

  const clearFile = () => {
    setSelectedFile(null);
    replacePreview(null);

    // Lets the same file be picked again afterwards.
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!isPdfFile(file) && !file.type.startsWith("image/")) {
      dispatch(setMessageError("Only PDF files and images can be attached."));
      clearFile();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      dispatch(setMessageError("That file is too large (max 20 MB)."));
      clearFile();
      return;
    }

    dispatch(setMessageError(null));
    setSelectedFile(file);
    replacePreview(file);
  };

  const handleSendMessage = async ({ prompt, conversationId }) => {
    const file = selectedFile;
    const text = prompt?.trim() || (file ? defaultPromptFor(file) : "");

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

      // multipart/form-data: works with and without an attached file.
      const formData = new FormData();
      formData.append("prompt", text);
      formData.append("conversationId", activeConversationId);
      formData.append("agent", selectedAgent.toLowerCase());

      if (file) {
        formData.append("file", file);
      }

      dispatch(
        addMessage({
          role: "user",
          content: file ? `${text}\n\n📎 ${file.name}` : text,
        }),
      );

      // Like the text box, the attachment is cleared as soon as it is sent.
      clearFile();

      const { data } = await api.post("/api/agent/chat", formData);

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
          addMessage({
            role: "assistant",
            content: response,
            images,
            artifacts,
          }),
        );
      }

      // Credits were spent on the server: refresh the balance in the sidebar.
      getCurrentUser().then((user) => {
        if (user) dispatch(setUserData(user));
      });

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

      const status = error.response?.status;

      dispatch(
        setMessageError(
          status === 402
            ? error.response?.data?.message ||
                "You're out of credits. Tap the credits card in the menu to add more."
            : status === 413
              ? "That file is too large (max 20 MB)."
              : "Failed to send message.",
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const prompt = message.trim();

    if ((!prompt && !selectedFile) || disabled || sending) return;

    setMessage("");

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    handleSendMessage({ prompt, conversationId });
  };

  const handleKeyDown = (event) => {
    // Ignore Enter while an IME composition is in progress, and on phones.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !isTouchDevice()
    ) {
      handleSubmit(event);
    }
  };

  return (
    <div className="w-full px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5 sm:pb-4 lg:px-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#171a22] shadow-lg transition focus-within:border-white/20"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-1 pt-3 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {selectedFile && (
          <div className="px-3 pt-3 sm:px-4">
            <div className="inline-flex max-w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-2 pl-2 pr-3">
              {isPdfFile(selectedFile) ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                  <FileText size={18} className="text-red-400" />
                </span>
              ) : (
                previewUrl && (
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                )
              )}

              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs text-white">
                  {selectedFile?.name}
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatSize(selectedFile?.size)}
                </span>
              </div>

              <button
                type="button"
                aria-label="Remove attachment"
                className="ml-1 shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                onClick={clearFile}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            growTextarea(event.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message AtlasAI..."
          readOnly={disabled}
          enterKeyHint="enter"
          rows={1}
          autoFocus={Boolean(initialValue)}
          className="max-h-48 min-h-14 w-full resize-none bg-transparent px-4 pt-2 text-base text-white outline-none placeholder:text-gray-500 read-only:opacity-60 sm:text-sm"
        />

        <input
          type="file"
          accept=".pdf,application/pdf,image/*"
          hidden
          ref={fileRef}
          onChange={handleFileChange}
        />

        <div className="flex items-center justify-between px-2 pb-3 sm:px-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              title="Attach file"
              aria-label="Attach file"
              disabled={disabled}
              className="rounded-lg p-2.5 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40 sm:p-2"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={18} />
            </button>

            <button
              type="button"
              title="Voice input"
              aria-label="Voice input"
              disabled={disabled}
              className="rounded-lg p-2.5 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40 sm:p-2"
            >
              <Mic size={18} />
            </button>

            <span className="hidden text-xs text-gray-500 sm:inline">
              Shift + Enter for a new line
            </span>
          </div>

          <button
            type="submit"
            disabled={(!message.trim() && !selectedFile) || disabled || sending}
            title="Send message"
            aria-label="Send message"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:h-9 sm:w-9"
          >
            <ArrowUp size={19} />
          </button>
        </div>
      </form>

      <p className="mx-auto mt-2 max-w-4xl text-center text-[11px] text-gray-500 sm:mt-3">
        AtlasAI can make mistakes. Verify important information.
      </p>
    </div>
  );
};

export default ChatInput;