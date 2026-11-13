import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Folder,
  Pencil,
  Trash2,
} from "lucide-react";

import ChatRow from "./ChatRow.jsx";
import PopupMenu, { MenuDivider, MenuItem } from "./PopupMenu.jsx";
import { deleteProject, renameProject } from "../features/organize.js";
import { removeProject, updateProject } from "../redux/conversationSlice.js";

// A project in the sidebar: click to show or hide its chats. The "..." menu
// renames the project or deletes it (its chats are kept).
const ProjectRow = ({
  project,
  chats,
  projects,
  selectedId,
  highlightTick = 0,
  onSelect,
  onPinChange,
  onMoved,
}) => {
  const dispatch = useDispatch();

  const menuButtonRef = useRef(null);
  const inputRef = useRef(null);
  const finishedRef = useRef(false);

  const [open, setOpen] = useState(() =>
    chats.some((chat) => chat._id === selectedId),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // Latest chats, readable from effects without re-running them on every render.
  const chatsRef = useRef(chats);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Open the project when a chat inside it is opened, or when a chat was just
  // added to it (highlightTick changes). Not on every render, so the user can
  // still collapse it afterwards.
  useEffect(() => {
    if (
      highlightTick > 0 ||
      chatsRef.current.some((chat) => chat._id === selectedId)
    ) {
      setOpen(true);
    }
  }, [highlightTick, selectedId]);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setConfirmDelete(false);
  }, []);

  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu();
    } else {
      setConfirmDelete(false);
      setMenuOpen(true);
    }
  };

  const startRename = () => {
    closeMenu();
    finishedRef.current = false;
    setDraft(project.name);
    setRenaming(true);
  };

  const finishRename = async (save) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const next = draft.trim();

    if (!save || !next || next === project.name) {
      setRenaming(false);
      return;
    }

    setBusy(true);
    const updated = await renameProject(project._id, next);
    setBusy(false);

    if (updated) {
      dispatch(updateProject({ _id: project._id, name: updated.name }));
    }

    setRenaming(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    const deleted = await deleteProject(project._id);
    setBusy(false);

    if (deleted) {
      dispatch(removeProject(project._id));
    }

    closeMenu();
  };

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div>
      <div
        className={`group relative flex items-center rounded-lg transition-colors duration-150 ${
          menuOpen ? "bg-[#1E293B]" : "hover:bg-[#1E293B]"
        }`}
      >
        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2">
            <Folder size={16} className="shrink-0 text-[#A78BFA]" />

            <input
              ref={inputRef}
              value={draft}
              maxLength={60}
              disabled={busy}
              aria-label="Project name"
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
            title={project.name}
            aria-expanded={open}
            onClick={() => setOpen((previous) => !previous)}
            className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left text-sm text-[#94A3B8] group-hover:text-[#F1F5F9]"
          >
            <Chevron size={14} className="shrink-0 text-[#64748B]" />
            <Folder size={16} className="shrink-0 text-[#A78BFA]" />
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            <span className="shrink-0 text-xs text-[#64748B]">
              {chats.length}
            </span>
          </button>
        )}

        {!renaming && (
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Project options"
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
          {confirmDelete ? (
            <div className="space-y-3 p-2">
              <p className="text-sm leading-5 text-[#CBD5E1]">
                Delete the project &quot;{project.name}&quot;? Its chats are
                kept and move back to Recent.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
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
          ) : (
            <>
              <MenuItem icon={Pencil} onClick={startRename}>
                Rename project
              </MenuItem>

              <MenuDivider />

              <MenuItem
                icon={Trash2}
                danger
                onClick={() => setConfirmDelete(true)}
              >
                Delete project
              </MenuItem>
            </>
          )}
        </PopupMenu>
      </div>

      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l border-[#263247] pl-2">
          {chats.length === 0 ? (
            <p className="px-2 py-2 text-xs leading-5 text-[#64748B]">
              No chats yet. Open a chat&apos;s menu and choose &quot;Add to
              project&quot;.
            </p>
          ) : (
            chats.map((chat) => (
              <ChatRow
                key={chat._id}
                conversation={chat}
                selected={selectedId === chat._id}
                projects={projects}
                onSelect={onSelect}
                onPinChange={onPinChange}
                onMoved={onMoved}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectRow;