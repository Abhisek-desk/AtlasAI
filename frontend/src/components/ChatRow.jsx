import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FolderMinus,
  FolderPlus,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";

import PopupMenu, { MenuDivider, MenuItem } from "./PopupMenu.jsx";
import {
  createProject,
  deleteConversationOnServer,
  updateConversationOnServer,
} from "../features/organize.js";
import {
  addProject,
  patchConversation,
  removeConversation,
} from "../redux/conversationSlice.js";
import { clearMessages } from "../redux/messageSlice.js";

// One chat in the sidebar: click to open it, and a "..." menu with
// Pin, Rename, Add to project and Delete.
const ChatRow = ({
  conversation,
  selected,
  projects,
  collapsed = false,
  labelHidden = "",
  railCenter = "",
  onSelect,
  onPinChange,
  onMoved,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const menuButtonRef = useRef(null);
  const inputRef = useRef(null);
  const finishedRef = useRef(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState("main"); // main | project | newProject | confirmDelete
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [busy, setBusy] = useState(false);

  const title = conversation.title || "New Chat";
  const pinned = Boolean(conversation.pinned);
  const currentProjectId = conversation.projectId
    ? String(conversation.projectId)
    : null;

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMode("main");
    setNewProjectName("");
  }, []);

  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu();
    } else {
      setMode("main");
      setMenuOpen(true);
    }
  };

  // Focus the name box when renaming starts.
  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  /* ------------------------------- Rename -------------------------------- */

  const startRename = () => {
    closeMenu();
    finishedRef.current = false;
    setDraft(title);
    setRenaming(true);
  };

  const finishRename = async (save) => {
    // Enter/Esc and the blur that follows must only count once.
    if (finishedRef.current) return;
    finishedRef.current = true;

    const next = draft.trim();

    if (!save || !next || next === title) {
      setRenaming(false);
      return;
    }

    setBusy(true);
    const updated = await updateConversationOnServer(conversation._id, {
      title: next,
    });
    setBusy(false);

    if (updated) {
      dispatch(patchConversation({ _id: conversation._id, title: updated.title }));
    }

    setRenaming(false);
  };

  /* --------------------------------- Pin --------------------------------- */

  const togglePin = async () => {
    setBusy(true);
    const updated = await updateConversationOnServer(conversation._id, {
      pinned: !pinned,
    });
    setBusy(false);

    if (updated) {
      dispatch(
        patchConversation({ _id: conversation._id, pinned: Boolean(updated.pinned) }),
      );
      onPinChange?.(Boolean(updated.pinned));
    }

    closeMenu();
  };

  /* ----------------------------- Add to project --------------------------- */

  const moveToProject = async (projectId) => {
    setBusy(true);
    const updated = await updateConversationOnServer(conversation._id, {
      projectId,
    });
    setBusy(false);

    if (updated) {
      dispatch(
        patchConversation({
          _id: conversation._id,
          projectId: updated.projectId ?? null,
        }),
      );
      onMoved?.(updated.projectId ? String(updated.projectId) : null);
    }

    closeMenu();
  };

  const createProjectAndMove = async () => {
    const name = newProjectName.trim();
    if (!name || busy) return;

    setBusy(true);
    const project = await createProject(name);
    setBusy(false);

    if (!project) return;

    dispatch(addProject(project));
    await moveToProject(project._id);
  };

  /* -------------------------------- Delete -------------------------------- */

  const handleDelete = async () => {
    setBusy(true);
    const deleted = await deleteConversationOnServer(conversation._id);
    setBusy(false);

    if (!deleted) return;

    dispatch(removeConversation(conversation._id));

    if (selected) {
      dispatch(clearMessages());
      navigate("/");
    }

    closeMenu();
  };

  /* -------------------------------- Menu body ----------------------------- */

  const backHeader = (label) => (
    <div className="mb-1 flex items-center gap-1 px-1 pb-1">
      <button
        type="button"
        aria-label="Back"
        onClick={() => setMode("main")}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
        {label}
      </span>
    </div>
  );

  let menuBody;

  if (mode === "project") {
    menuBody = (
      <>
        {backHeader("Add to project")}

        <div className="max-h-52 overflow-y-auto">
          {projects.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-[#64748B]">
              No projects yet. Create one below.
            </p>
          )}

          {projects.map((project) => (
            <MenuItem
              key={project._id}
              icon={FolderPlus}
              disabled={busy}
              onClick={() => moveToProject(project._id)}
              trailing={
                currentProjectId === String(project._id) ? (
                  <Check size={14} className="text-[#A78BFA]" />
                ) : null
              }
            >
              {project.name}
            </MenuItem>
          ))}
        </div>

        <MenuDivider />

        <MenuItem icon={Plus} onClick={() => setMode("newProject")}>
          New project
        </MenuItem>

        {currentProjectId && (
          <MenuItem
            icon={FolderMinus}
            disabled={busy}
            onClick={() => moveToProject(null)}
          >
            Remove from project
          </MenuItem>
        )}
      </>
    );
  } else if (mode === "newProject") {
    menuBody = (
      <>
        {backHeader("New project")}

        <div className="space-y-2 px-1.5 pb-1.5">
          <input
            autoFocus
            value={newProjectName}
            maxLength={60}
            placeholder="Project name"
            onChange={(event) => setNewProjectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createProjectAndMove();
            }}
            className="w-full rounded-lg border border-[#263247] bg-[#111A2E] px-3 py-2 text-sm text-[#F1F5F9] outline-none placeholder:text-[#64748B] focus:border-violet-400/50"
          />

          <button
            type="button"
            disabled={busy || !newProjectName.trim()}
            onClick={createProjectAndMove}
            className="w-full rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#6366F1] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create and add chat
          </button>
        </div>
      </>
    );
  } else if (mode === "confirmDelete") {
    menuBody = (
      <div className="space-y-3 p-2">
        <p className="text-sm leading-5 text-[#CBD5E1]">
          Delete this chat? Its messages will be removed and this can&apos;t be
          undone.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("main")}
            className="flex-1 rounded-lg border border-[#263247] px-3 py-2 text-sm text-[#CBD5E1] transition hover:bg-[#1E293B]"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="flex-1 rounded-lg bg-red-500/90 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    );
  } else {
    menuBody = (
      <>
        <MenuItem
          icon={pinned ? PinOff : Pin}
          disabled={busy}
          onClick={togglePin}
        >
          {pinned ? "Unpin chat" : "Pin chat"}
        </MenuItem>

        <MenuItem icon={Pencil} onClick={startRename}>
          Rename
        </MenuItem>

        <MenuItem
          icon={FolderPlus}
          onClick={() => setMode("project")}
          trailing={<ChevronRight size={14} className="text-[#64748B]" />}
        >
          Add to project
        </MenuItem>

        <MenuDivider />

        <MenuItem icon={Trash2} danger onClick={() => setMode("confirmDelete")}>
          Delete chat
        </MenuItem>
      </>
    );
  }

  /* -------------------------------- Row ----------------------------------- */

  const RowIcon = pinned ? Pin : MessageSquare;

  return (
    <div
      className={`group relative flex items-center rounded-lg border transition-colors duration-150 ${
        selected
          ? "border-violet-400/15 bg-violet-500/10"
          : menuOpen
            ? "border-transparent bg-[#1E293B]"
            : "border-transparent hover:bg-[#1E293B]"
      }`}
    >
      {renaming ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
          <RowIcon size={16} className="shrink-0 text-[#A78BFA]" />

          <input
            ref={inputRef}
            value={draft}
            maxLength={80}
            disabled={busy}
            aria-label="Chat name"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") finishRename(true);
              if (event.key === "Escape") finishRename(false);
            }}
            onBlur={() => finishRename(true)}
            className="min-w-0 flex-1 rounded-md border border-violet-400/40 bg-[#111A2E] px-2 py-1 text-sm text-[#F1F5F9] outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          title={title}
          onClick={() => onSelect?.(conversation)}
          className={`flex min-w-0 flex-1 items-center justify-start gap-3 px-3 py-3 text-left text-sm md:py-2.5 ${railCenter} ${
            selected
              ? "text-violet-200"
              : "text-[#94A3B8] group-hover:text-[#F1F5F9]"
          }`}
        >
          <RowIcon
            size={16}
            className={`shrink-0 ${
              selected
                ? "text-[#A78BFA]"
                : "text-[#64748B] group-hover:text-[#A78BFA]"
            }`}
          />

          <span className={`truncate ${labelHidden}`}>{title}</span>
        </button>
      )}

      {!renaming && !collapsed && (
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Chat options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
          className={`mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 pointer-coarse:opacity-100 ${
            menuOpen ? "opacity-100" : "md:opacity-0 md:group-hover:opacity-100"
          }`}
        >
          <Ellipsis size={16} />
        </button>
      )}

      <PopupMenu anchorRef={menuButtonRef} open={menuOpen} onClose={closeMenu}>
        {menuBody}
      </PopupMenu>
    </div>
  );
};

export default ChatRow;