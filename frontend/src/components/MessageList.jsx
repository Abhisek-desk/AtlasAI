import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import {
  Bot,
  User,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Code2,
  Download,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import LoadingAnimation from "./LoadingAnimation";
import { setArtifactMobileOpen, setArtifacts } from "../redux/messageSlice.js";

const SUGGESTIONS = [
  "Write a Netflix clone",
  "Explain Redis",
  "Build a dashboard",
];

const REMARK_PLUGINS = [remarkGfm];

const toText = (content) =>
  typeof content === "string" ? content : JSON.stringify(content ?? "");

const unwrapMarkdownFence = (text) => {
  const match = /^\s*```(?:markdown|md)[ \t]*\n([\s\S]*?)\n```\s*$/i.exec(text);

  return match ? match[1] : text;
};

/* -------------------------------------------------------------------------- */
/*  Code block: language label + copy button + line numbers + highlighting    */
/* -------------------------------------------------------------------------- */

const CODE_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

// Also used by the Artifact panel (`bare` removes the card margin/border and
// lets the code area fill its parent, `label` replaces the language name).
export const CodeBlock = ({ code, language = "text", label, bare = false }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy code error:", err);
    }
  };

  return (
    <div
      className={
        bare
          ? "flex h-full min-h-0 flex-col bg-[#111318]"
          : "my-4 overflow-hidden rounded-xl border border-white/10 bg-[#111318]"
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#1b1d24] px-4 py-2">
        <span
          className={`truncate text-xs text-slate-400 ${
            label ? "" : "uppercase"
          }`}
        >
          {label || language}
        </span>

        <button
          type="button"
          onClick={copyCode}
          aria-label="Copy code"
          className="flex shrink-0 items-center gap-1 text-xs text-slate-400 transition hover:text-white"
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>

      <div
        className={bare ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto"}
      >
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          showLineNumbers
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "13px",
            lineHeight: "1.6",
          }}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: "#4b5263",
            fontStyle: "italic",
            userSelect: "none",
          }}
          codeTagProps={{ style: { fontFamily: CODE_FONT } }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Links: clickable, with a hover card offering Copy / Go                    */
/* -------------------------------------------------------------------------- */

const HTTP_URL = /^https?:\/\//i;
const CARD_WIDTH = 288;

const getHost = (href) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
};

const LINK_CLASS =
  "break-words rounded-sm text-indigo-400 underline decoration-indigo-400/40 underline-offset-2 transition hover:bg-indigo-400/10 hover:text-indigo-300 hover:decoration-indigo-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400";

const MarkdownLink = ({ href, children }) => {
  const anchorRef = useRef(null);
  const closeTimerRef = useRef(null);
  const copyTimerRef = useRef(null);

  const [card, setCard] = useState(null); // { top, left, above } | null
  const [copied, setCopied] = useState(false);

  const isWebLink = typeof href === "string" && HTTP_URL.test(href);

  const cancelClose = () => clearTimeout(closeTimerRef.current);

  const closeNow = () => {
    cancelClose();
    setCard(null);
  };

  // Small delay so the pointer can travel from the link to the card.
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setCard(null), 150);
  };

  const openCard = () => {
    cancelClose();

    const element = anchorRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const above = rect.bottom + 120 > window.innerHeight && rect.top > 140;

    setCard({
      above,
      left: Math.max(
        8,
        Math.min(rect.left, window.innerWidth - CARD_WIDTH - 8),
      ),
      top: above ? rect.top - 6 : rect.bottom + 6,
    });
  };

  // The card uses fixed positioning, so close it if the page moves under it.
  useEffect(() => {
    if (!card) return;

    const close = () => setCard(null);

    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [card]);

  useEffect(
    () => () => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(href);

      setCopied(true);

      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy link error:", err);
    }
  };

  // mailto:, #anchors, relative links: plain styled link, no card.
  if (!isWebLink) {
    return (
      <a href={href} className={LINK_CLASS}>
        {children}
      </a>
    );
  }

  return (
    <>
      <a
        ref={anchorRef}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={openCard}
        onMouseLeave={scheduleClose}
        onFocus={openCard}
        onBlur={scheduleClose}
        onKeyDown={(event) => event.key === "Escape" && closeNow()}
        className={LINK_CLASS}
      >
        {children}
      </a>

      {card && (
        <span
          role="tooltip"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onFocus={cancelClose}
          onBlur={scheduleClose}
          style={{
            position: "fixed",
            top: card.top,
            left: card.left,
            width: CARD_WIDTH,
            transform: card.above ? "translateY(-100%)" : undefined,
          }}
          className="z-50 flex flex-col gap-2 rounded-xl border border-white/10 bg-[#1b1f2a] p-3 text-left shadow-2xl shadow-black/40"
        >
          <span className="block truncate text-sm font-medium text-gray-100">
            {getHost(href)}
          </span>

          <span className="line-clamp-2 block break-all text-[11px] leading-4 text-gray-500">
            {href}
          </span>

          <span className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={copyLink}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-white/10"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>

            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeNow}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400"
            >
              <ExternalLink size={13} />
              Go
            </a>
          </span>
        </span>
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Images in answers (e.g. generated images): preview + open + download      */
/* -------------------------------------------------------------------------- */

const getImageName = (src) => {
  try {
    const name = decodeURIComponent(
      new URL(src).pathname.split("/").pop() || "",
    );

    return name || "image.png";
  } catch {
    return "image.png";
  }
};

// Only <span>s are used because react-markdown renders images inside a <p>.
const GeneratedImage = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!src) return null;

  const downloadImage = async () => {
    setDownloading(true);

    try {
      const response = await fetch(src);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const url = URL.createObjectURL(await response.blob());

      const link = document.createElement("a");
      link.href = url;
      link.download = getImageName(src);

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      // Usually the bucket's CORS rules: open the image so it can be saved.
      console.error("Download image error:", err);
      window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <span className="my-3 block w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#111318]">
      {failed ? (
        <span className="flex items-center gap-2 px-4 py-6 text-sm text-gray-400">
          <AlertCircle size={16} className="shrink-0" />
          This image could not be loaded. Its link may have expired.
        </span>
      ) : (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className={`relative block ${loaded ? "" : "min-h-48"}`}
        >
          {!loaded && (
            <span className="absolute inset-0 animate-pulse bg-white/5" />
          )}

          <img
            src={src}
            alt={alt || "Generated image"}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`block h-auto max-h-[28rem] w-full object-contain transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </a>
      )}

      {!failed && (
        <span className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#1b1d24] px-3 py-2">
          <span className="truncate text-xs text-slate-400">
            {alt || "Image"}
          </span>

          <span className="flex shrink-0 items-center gap-3">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
            >
              <ExternalLink size={14} />
              Open
            </a>

            <button
              type="button"
              onClick={downloadImage}
              disabled={downloading}
              className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-white disabled:opacity-50"
            >
              <Download size={14} />
              {downloading ? "Saving..." : "Download"}
            </button>
          </span>
        </span>
      )}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/*  Markdown element styles                                                   */
/* -------------------------------------------------------------------------- */

// Defined once so react-markdown doesn't get a new object on every render.
const markdownComponents = {
  // ---- Headings -----------------------------------------------------------
  h1: ({ children }) => (
    <h1 className="mb-4 mt-6 border-b border-white/10 pb-2 text-2xl font-bold tracking-tight text-white first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-6 border-b border-white/5 pb-1.5 text-xl font-semibold tracking-tight text-white first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-5 text-lg font-semibold text-gray-100 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-4 text-base font-semibold text-gray-200 first:mt-0">
      {children}
    </h4>
  ),

  // ---- Text ---------------------------------------------------------------
  p: ({ children }) => (
    <p className="mb-3 leading-7 text-gray-200 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-gray-100">{children}</em>,
  del: ({ children }) => (
    <del className="text-gray-500 line-through">{children}</del>
  ),
  hr: () => <hr className="my-5 border-white/10" />,
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-lg border-l-4 border-indigo-400 bg-white/[0.03] py-2 pl-4 pr-3 text-gray-400 [&>p]:mb-1 [&>p]:text-gray-400">
      {children}
    </blockquote>
  ),
  a: MarkdownLink,

  // ---- Lists (incl. GFM task lists) ---------------------------------------
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-6 marker:text-gray-500 [&_ol]:mt-1.5 [&_ul]:mt-1.5 [&_ul]:list-[circle]">
      {children}
    </ul>
  ),
  ol: ({ start, children }) => (
    <ol
      start={start}
      className="mb-3 list-decimal space-y-1.5 pl-6 marker:text-gray-500 [&_ol]:mt-1.5 [&_ul]:mt-1.5"
    >
      {children}
    </ol>
  ),
  li: ({ className, children }) => {
    // remark-gfm marks task list items with "task-list-item".
    const isTask = String(className || "").includes("task-list-item");

    return (
      <li
        className={`leading-7 text-gray-200 [&>p]:mb-1 ${
          isTask ? "-ml-6 list-none" : ""
        }`}
      >
        {children}
      </li>
    );
  },
  input: ({ type, checked }) =>
    type === "checkbox" ? (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled
        readOnly
        className="mr-2 h-3.5 w-3.5 translate-y-[1px] accent-indigo-500"
      />
    ) : null,

  // ---- Code ---------------------------------------------------------------
  // CodeBlock draws its own card, so <pre> must not add a second box.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const value = String(children).replace(/\n$/, "");
    const match = /language-([\w-]+)/.exec(className || "");

    // No language and a single line: inline `code`.
    if (!match && !value.includes("\n")) {
      return (
        <code className="break-words rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-indigo-300">
          {value}
        </code>
      );
    }

    return <CodeBlock code={value} language={match ? match[1] : "text"} />;
  },

  // ---- Tables (GFM) -------------------------------------------------------
  table: ({ children }) => (
    <div className="my-4 w-full overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-max border-collapse text-left text-sm [&_tbody_tr:nth-child(even)]:bg-white/[0.03]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
  tr: ({ children }) => (
    <tr className="border-b border-white/10 last:border-b-0">{children}</tr>
  ),
  th: ({ style, children }) => (
    <th
      style={style}
      className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-300"
    >
      {children}
    </th>
  ),
  td: ({ style, children }) => (
    <td style={style} className="px-4 py-2.5 align-top text-gray-200">
      {children}
    </td>
  ),

  // ---- Images written in markdown ----------------------------------------
  img: ({ src, alt }) => <GeneratedImage src={src} alt={alt} />,
};

/* -------------------------------------------------------------------------- */
/*  One chat message                                                          */
/* -------------------------------------------------------------------------- */

const MessageItem = memo(function MessageItem({
  message,
  messageId,
  copied,
  onCopy,
  onOpenArtifacts,
}) {
  const isUser = message.role === "user";
  const content = isUser
    ? toText(message.content)
    : unwrapMarkdownFence(toText(message.content));

  const images = Array.isArray(message.images)
    ? message.images.filter((src) => typeof src === "string" && src)
    : [];

  const visibleImages = images.slice(0, 6);

  const artifacts = Array.isArray(message.artifacts) ? message.artifacts : [];
  const fileCount = artifacts.reduce(
    (total, artifact) =>
      total + (Array.isArray(artifact?.files) ? artifact.files.length : 0),
    0,
  );

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
        className={`min-w-0 ${
          isUser
            ? "max-w-[85%] text-right sm:max-w-[80%]"
            : "max-w-[85%] text-left sm:max-w-[90%]"
        }`}
      >
        <div className="mb-2 text-xs font-medium text-gray-400">
          {isUser ? "You" : "AtlasAI"}
        </div>

        {/* Images first, above the text */}
        {!isUser && visibleImages.length > 0 && (
          <div
            className={`mb-4 grid gap-2 ${
              visibleImages.length === 1
                ? "grid-cols-1"
                : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {visibleImages.map((src) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-white/10 bg-[#111318]"
              >
                <img
                  src={src}
                  alt="Search result"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className={`w-full object-cover transition hover:opacity-90 ${
                    visibleImages.length === 1
                      ? "max-h-80 sm:max-h-96"
                      : "aspect-video h-full"
                  }`}
                  onError={(event) => {
                    event.currentTarget.parentElement.style.display = "none";
                  }}
                />
              </a>
            ))}
          </div>
        )}

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

        {/* Generated project: click to show it in the artifact panel */}
        {!isUser && fileCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenArtifacts(artifacts)}
            className="mt-3 flex w-full max-w-sm items-center gap-3 rounded-xl border border-white/10 bg-[#171a22] p-3 text-left transition hover:bg-[#1d212b]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
              <Code2 size={18} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-100">
                {artifacts[0]?.title || "Project"}
              </span>
              <span className="block text-xs text-gray-500">
                {fileCount} {fileCount === 1 ? "file" : "files"} · Click to open
              </span>
            </span>
          </button>
        )}

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

/* -------------------------------------------------------------------------- */
/*  Message list                                                              */
/* -------------------------------------------------------------------------- */

const MessageList = ({
  messages = [],
  loading = false,
  sending = false,
  error = "",
  onSuggestionClick,
}) => {
  const dispatch = useDispatch();
  const bottomRef = useRef(null);
  const copyTimerRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // Stable reference so memoised messages don't re-render on every update.
  const openArtifacts = useCallback(
    (artifacts) => {
      dispatch(setArtifacts(artifacts));
      // Below lg the artifact opens full screen; on desktop this is ignored.
      dispatch(setArtifactMobileOpen(true));
    },
    [dispatch],
  );

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
        <LoadingAnimation variant="page" label="Loading conversation..." />
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
                onOpenArtifacts={openArtifacts}
              />
            );
          })}

          {sending && (
            <div className="flex gap-3 sm:gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:h-9 sm:w-9">
                <Bot size={19} />
              </div>

              <LoadingAnimation variant="typing" />
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
