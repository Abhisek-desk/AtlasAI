import { memo, useEffect, useRef, useState } from "react";
import { Bot, User, Copy, Check, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SUGGESTIONS = [
  "Write a Netflix clone",
  "Explain Redis",
  "Build a dashboard",
];

const REMARK_PLUGINS = [remarkGfm];

const toText = (content) =>
  typeof content === "string" ? content : JSON.stringify(content ?? "");

// Defined once so react-markdown doesn't get a new object on every render.
const markdownComponents = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-2xl font-bold text-white">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-4 text-xl font-bold text-white">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold text-white">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-indigo-400 pl-4 text-gray-400">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 underline hover:text-indigo-300"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-[#111318] p-4 text-sm leading-6">
      {children}
    </pre>
  ),
  // Props are not spread, so react-markdown's `node` prop never reaches the
  // DOM. Fenced blocks without a language have no className, so also check
  // for newlines to tell them apart from inline code.
  code: ({ className, children }) => {
    const isBlock = Boolean(className) || /\n/.test(String(children));

    return isBlock ? (
      <code className={`${className || ""} font-mono`}>{children}</code>
    ) : (
      <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-indigo-200">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-white/10 px-3 py-2">{children}</td>
  ),
  hr: () => <hr className="my-4 border-white/10" />,
};

const MessageItem = memo(function MessageItem({
  message,
  messageId,
  copied,
  onCopy,
}) {
  const isUser = message.role === "user";
  const content = toText(message.content);

  return (
    <article
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
          className={`break-words text-sm leading-7 ${
            isUser
              ? "inline-block rounded-2xl rounded-tr-sm bg-[#202531] px-4 py-3 text-left text-gray-100"
              : "text-gray-200"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <div className="markdown-content max-w-none">
              <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && (
          <div className="mt-2 flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onCopy(content, messageId)}
              title="Copy message"
              aria-label="Copy assistant response"
              className="rounded-lg p-2 text-gray-500 hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        )}
      </div>
    </article>
  );
});

const MessageList = ({
  messages = [],
  loading = false,
  sending = false,
  error = "",
  onSuggestionClick,
}) => {
  const bottomRef = useRef(null);
  const copyTimerRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const copyMessage = async (content, messageId) => {
    try {
      await navigator.clipboard.writeText(content);

      setCopiedId(messageId);

      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Copy message error:", err);
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AtlasAI
          </h1>

          <h2 className="mt-4 text-base font-semibold text-gray-200 sm:text-lg">
            How can I help you?
          </h2>

          <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
            Ask me anything — code, ideas, explanations, or just a quick
            question.
          </p>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-left text-sm text-red-400">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="mt-7 flex w-full max-w-2xl flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick?.(suggestion)}
                className="rounded-xl border border-white/5 bg-[#171a22] px-4 py-3 text-xs text-gray-300 transition hover:bg-[#20232d] sm:text-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-4xl space-y-7">
          {messages.map((message, index) => {
            const messageId = message._id || message.id || `local-${index}`;

            return (
              <MessageItem
                key={messageId}
                message={message}
                messageId={messageId}
                copied={copiedId === messageId}
                onCopy={copyMessage}
              />
            );
          })}

          {sending && (
            <div className="flex gap-3 sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Bot size={19} />
              </div>

              <div
                className="flex items-center gap-1.5 pt-3"
                role="status"
                aria-label="AtlasAI is responding"
              >
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