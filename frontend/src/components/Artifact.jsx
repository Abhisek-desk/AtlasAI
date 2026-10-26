import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "motion/react";

import LoadingAnimation from "./LoadingAnimation";
import {
  setArtifactMobileOpen,
  setArtifactOpen,
} from "../redux/messageSlice.js";

// Same breakpoint as Tailwind's `lg`: side panel on desktop, full screen below.
const DESKTOP_QUERY = "(min-width: 1024px)";

const subscribeToDesktop = (callback) => {
  const query = window.matchMedia(DESKTOP_QUERY);

  query.addEventListener("change", callback);

  return () => query.removeEventListener("change", callback);
};

const useIsDesktop = () =>
  useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );

const NO_EDITS = {};

const LANGUAGES = {
  html: "html",
  htm: "html",
  css: "css",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  json: "json",
  md: "markdown",
  py: "python",
  java: "java",
  sh: "bash",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  env: "bash",
};

// Monaco has no separate jsx/tsx/bash ids.
const MONACO_LANGUAGES = {
  jsx: "javascript",
  tsx: "typescript",
  bash: "shell",
  text: "plaintext",
};

const getLanguage = (fileName = "") =>
  LANGUAGES[fileName.split(".").pop().toLowerCase()] || "text";

const getMonacoLanguage = (fileName) => {
  const language = getLanguage(fileName);

  return MONACO_LANGUAGES[language] || language;
};

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  lineHeight: 21,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 12, bottom: 12 },
  smoothScrolling: true,
  renderLineHighlight: "line",
};

// Same background as the code blocks in the chat.
const defineTheme = (monaco) => {
  monaco.editor.defineTheme("atlas-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#111318",
      "editorGutter.background": "#111318",
      "editorLineNumber.foreground": "#4b5263",
      "editorLineNumber.activeForeground": "#9ca3af",
      "editor.lineHighlightBackground": "#1b1d24",
    },
  });
};

// "./css/style.css" and "/style.css" both match a file named "style.css".
const findFile = (files, path) => {
  const clean = String(path).replace(/^(\.\/|\/)+/, "");
  const base = clean.split("/").pop();

  return files.find(
    (file) =>
      file.name === clean || file.name.split("/").pop() === base,
  );
};

// Inline the project's own CSS and JS into the HTML so it can run inside a
// single sandboxed iframe. Returns "" when the project has no HTML file.
const buildPreviewDoc = (files) => {
  const html = files.find((file) => /\.html?$/i.test(file.name));

  if (!html) return "";

  // Replacer functions are used so "$&" etc. in the code is not interpreted.
  return html.content
    .replace(/<link\b[^>]*>/gi, (tag) => {
      if (!/rel=["']?stylesheet/i.test(tag)) return tag;

      const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
      const css = href ? findFile(files, href) : null;

      return css ? `<style>\n${css.content}\n</style>` : tag;
    })
    .replace(
      /<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
      (tag, before, src, after) => {
        const js = findFile(files, src);

        if (!js) return tag;

        return `<script${before}${after}>\n${js.content.replace(/<\/script/gi, "<\\/script")}\n</script>`;
      },
    );
};

const downloadFile = (file) => {
  const url = URL.createObjectURL(
    new Blob([file.content], { type: "text/plain;charset=utf-8" }),
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = file.name.split("/").pop() || "file.txt";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const Artifact = () => {
  const dispatch = useDispatch();
  const isDesktop = useIsDesktop();

  const [view, setView] = useState("preview");
  const [activeName, setActiveName] = useState(null);
  // Edits made in the editor, kept per artifact so a new project starts clean.
  const [edits, setEdits] = useState({ artifactId: null, files: NO_EDITS });
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);

  const { artifacts, artifactOpen, artifactMobileOpen } = useSelector(
    (state) => state.message,
  );

  const collapsed = artifactOpen === false;
  const artifact = artifacts?.[0];
  const artifactId = artifact?.id ?? artifact?.title ?? "artifact";

  const baseFiles = useMemo(
    () => (Array.isArray(artifact?.files) ? artifact.files : []),
    [artifact],
  );

  const editedFiles = edits.artifactId === artifactId ? edits.files : NO_EDITS;

  const files = useMemo(
    () =>
      baseFiles.map((file) =>
        editedFiles[file.name] !== undefined
          ? { ...file, content: editedFiles[file.name] }
          : file,
      ),
    [baseFiles, editedFiles],
  );

  const previewDoc = useMemo(() => buildPreviewDoc(files), [files]);

  const showMobileView = !isDesktop && artifactMobileOpen && files.length > 0;

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // Esc closes the full-screen view.
  useEffect(() => {
    if (!showMobileView) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") dispatch(setArtifactMobileOpen(false));
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showMobileView, dispatch]);

  // Only show the panel when this conversation has an artifact.
  if (files.length === 0) return null;

  // Below lg the artifact is opened from the chat card, not shown by default.
  if (!isDesktop && !artifactMobileOpen) return null;

  const activeFile = files.find((file) => file.name === activeName) || files[0];
  const canPreview = Boolean(previewDoc);
  const currentView = canPreview && view === "preview" ? "preview" : "code";

  const handleEdit = (value) => {
    setEdits((prev) => ({
      artifactId,
      files: {
        ...(prev.artifactId === artifactId ? prev.files : NO_EDITS),
        [activeFile.name]: value ?? "",
      },
    }));
  };

  const copyFile = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);

      setCopied(true);

      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy file error:", err);
    }
  };

  if (isDesktop && collapsed) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden lg:flex h-full border-l border-white/[0.06] flex-col items-center justify-start p-3 bg-zinc-950 shrink-0"
      >
        <button
          onClick={() => dispatch(setArtifactOpen(true))}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
          title="Expand artifact"
        >
          <PanelRightOpen className="w-5 h-5" />
        </button>
      </motion.div>
    );
  }

  // Shared by the desktop panel and the full-screen phone view.
  const header = (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3 border-b border-white/[0.06] bg-zinc-900/50 sm:gap-3 sm:px-4">
      <div className="flex items-center gap-2 min-w-0 sm:gap-3">
        {isDesktop ? (
          <button
            onClick={() => dispatch(setArtifactOpen(false))}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
            title="Collapse artifact"
          >
            <PanelRightClose className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => dispatch(setArtifactMobileOpen(false))}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
            title="Close"
            aria-label="Close artifact"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="hidden p-1.5 bg-blue-500/10 text-blue-400 rounded-lg items-center justify-center sm:flex">
          <Code2 className="w-4 h-4" />
        </div>
        <div className="text-sm font-medium truncate text-zinc-200">
          {artifact?.title || "Artifact"}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canPreview && (
          <div className="flex rounded-lg bg-white/[0.06] p-0.5 text-xs font-medium">
            <button
              onClick={() => setView("preview")}
              aria-label="Preview"
              className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 transition-colors sm:px-2.5 sm:py-1 ${
                currentView === "preview"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              onClick={() => setView("code")}
              aria-label="Code"
              className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 transition-colors sm:px-2.5 sm:py-1 ${
                currentView === "code"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Code</span>
            </button>
          </div>
        )}

        <button
          onClick={copyFile}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer sm:p-1.5"
          title={`Copy ${activeFile.name}`}
          aria-label="Copy file"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={() => downloadFile(activeFile)}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer sm:p-1.5"
          title={`Download ${activeFile.name}`}
          aria-label="Download file"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const body =
    currentView === "preview" ? (
      <iframe
        title="Preview"
        srcDoc={previewDoc}
        sandbox="allow-scripts allow-forms allow-modals"
        className="min-h-0 w-full flex-1 bg-white"
      />
    ) : (
      <div className="flex min-h-0 flex-1 flex-col">
        {files.length > 1 && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/[0.06] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {files.map((file) => (
              <button
                key={file.name}
                onClick={() => setActiveName(file.name)}
                className={`flex max-w-[180px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  file.name === activeFile.name
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
                }`}
              >
                <span className="truncate">{file.name}</span>
                {editedFiles[file.name] !== undefined && (
                  <span
                    title="Edited"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Monaco editor: edits update the preview and downloads */}
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            path={`${artifactId}/${activeFile.name}`}
            language={getMonacoLanguage(activeFile.name)}
            value={activeFile.content}
            theme="atlas-dark"
            beforeMount={defineTheme}
            onChange={handleEdit}
            options={EDITOR_OPTIONS}
            loading={
              <div className="flex h-full items-center justify-center">
                <LoadingAnimation variant="spinner" label="Loading editor" />
              </div>
            }
          />
        </div>
      </div>
    );

  if (!isDesktop) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={artifact?.title || "Artifact"}
        className="fixed inset-0 z-40 flex h-dvh flex-col bg-zinc-950 pb-[env(safe-area-inset-bottom)] text-zinc-100"
      >
        {header}
        {body}
      </div>
    );
  }

  return (
    <div className="hidden lg:flex h-full w-80 xl:w-[28rem] 2xl:w-[32rem] border-l border-white/[0.06] flex-col overflow-hidden bg-zinc-950 shrink-0 text-zinc-100">
      {header}
      {body}
    </div>
  );
};


export default Artifact;