import { useEffect, useRef, useState } from "react";
import {
  Bot,
  User,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
} from "lucide-react";

const MessageList = ({
  messages = [],
  loading = false,
  sending = false,
  error = "",
  onNewChat,
}) => {
  const bottomRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending]);

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopiedId(message._id);

      setTimeout(() => {
        setCopiedId(null);
      }, 1500);
    } catch (error) {
      console.error("Copy message error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-6 sm:px-5 lg:px-8">
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center px-2 py-8 text-center sm:px-4 sm:py-12">
          <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#171a22]">
            <Sparkles size={30} className="text-white" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            What can I help you with?
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-gray-400">
            Ask a question, explore an idea, or start working on something
            new with AtlasAI.
          </p>

          {error && (
            <p className="mt-4 max-w-md text-sm text-red-400">{error}</p>
          )}

          <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onNewChat}
              className="rounded-xl border border-white/10 bg-[#14171e] p-4 text-left transition hover:border-white/20 hover:bg-[#191d26]"
            >
              <p className="text-sm font-medium text-gray-200">
                Brainstorm ideas
              </p>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Find fresh ideas for your next project.
              </p>
            </button>

            <button
              type="button"
              onClick={onNewChat}
              className="rounded-xl border border-white/10 bg-[#14171e] p-4 text-left transition hover:border-white/20 hover:bg-[#191d26]"
            >
              <p className="text-sm font-medium text-gray-200">
                Learn something new
              </p>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Explore a topic and understand how it works.
              </p>
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-4xl space-y-7">
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const messageId = message._id || message.id || index;

            return (
              <article
                key={messageId}
                className={`group flex gap-3 sm:gap-4 ${
                  isUser ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isUser
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-white/10 text-gray-200"
                  }`}
                >
                  {isUser ? <User size={18} /> : <Bot size={19} />}
                </div>

                <div
                  className={`min-w-0 max-w-[85%] sm:max-w-[80%] ${
                    isUser ? "text-right" : "text-left"
                  }`}
                >
                  <div className="mb-2 text-xs font-medium text-gray-400">
                    {isUser ? "You" : "AtlasAI"}
                  </div>

                  <div
                    className={`inline-block whitespace-pre-wrap break-words text-left text-sm leading-7 ${
                      isUser
                        ? "rounded-2xl rounded-tr-sm bg-[#202531] px-4 py-3 text-gray-100"
                        : "text-gray-200"
                    }`}
                  >
                    {message.content}
                  </div>

                  {!isUser && (
                    <div className="mt-2 flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => copyMessage(message)}
                        title="Copy message"
                        className="rounded-lg p-2 text-gray-500 hover:bg-white/10 hover:text-white"
                      >
                        {copiedId === message._id ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {sending && (
            <div className="flex gap-3 sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Bot size={19} />
              </div>

              <div className="flex items-center gap-1.5 pt-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

export default MessageList;