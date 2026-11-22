import {
  PanelLeftIcon,
  SquarePen,
  LogOut,
  Coins,
  X,
  FolderKanban,
  Pin,
  ChevronDown,
  Plus,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { getConversations } from "../features/getConversations.js";
import { createConversation } from "../features/createConversation.js";
import { createProject, fetchProjects } from "../features/organize.js";
import logout from "../features/logout.js";

import {
  addConversation,
  addProject,
  setConversations,
  setProjects,
  clearSelectedConversation,
} from "../redux/conversationSlice.js";
import { clearMessages } from "../redux/messageSlice.js";
import { setUserData } from "../redux/userSlice.js";

import BillingDrawer from "./BillingDrawer";
import ChatRow from "./ChatRow.jsx";
import ProjectRow from "./ProjectRow.jsx";

const NO_CHATS = [];

// A "Projects" / "Pinned chats" row under the New Chat button. It opens or
// closes its list; on the icon-only rail it expands the sidebar first.
const SectionButton = ({
  icon: Icon,
  label,
  count,
  open,
  onClick,
  labelHidden,
  railCenter,
}) => (
  <button
    type="button"
    title={label}
    aria-expanded={open}
    onClick={onClick}
    className={`flex h-10 w-full min-w-0 items-center justify-start gap-3 rounded-lg px-3 text-sm text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-[#F1F5F9] ${railCenter}`}
  >
    <Icon size={17} className="shrink-0 text-[#A78BFA]" />

    <span className={`min-w-0 flex-1 truncate text-left ${labelHidden}`}>
      {label}
    </span>

    <span
      className={`rounded-md bg-[#1E293B] px-1.5 py-0.5 text-[11px] text-[#64748B] ${labelHidden}`}
    >
      {count}
    </span>

    <ChevronDown
      size={14}
      className={`shrink-0 text-[#64748B] transition-transform ${
        open ? "" : "-rotate-90"
      } ${labelHidden}`}
    />
  </button>
);

// Phones: a slide-in drawer (mobileOpen / onMobileClose come from Home).
// md and up: a normal column that can be collapsed to an icon rail.
const Sidebar = ({ mobileOpen = false, onMobileClose }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const [projectsOpen, setProjectsOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  // Which project just received a chat (so it opens): { projectId, tick }
  const [highlight, setHighlight] = useState({ projectId: null, tick: 0 });

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { conversations, selectedConversation, projects } = useSelector(
    (state) => state.conversation,
  );

  const userData = useSelector((state) => state.user?.userData);
  const isLoggedIn = Boolean(userData);

  // Labels are always visible in the phone drawer, and hidden on md+ only
  // while the sidebar is collapsed to its icon rail.
  const labelHidden = collapsed ? "md:hidden" : "";
  const railCenter = collapsed ? "md:justify-center" : "";

  const closeMobile = () => onMobileClose?.();

  const safeConversations = useMemo(
    () => (Array.isArray(conversations) ? conversations : NO_CHATS),
    [conversations],
  );
  const safeProjects = useMemo(
    () => (Array.isArray(projects) ? projects : NO_CHATS),
    [projects],
  );

  // Pinned chats, chats grouped by project, and the rest ("Recent").
  const { pinnedChats, chatsByProject, recentChats } = useMemo(() => {
    const projectIds = new Set(safeProjects.map((project) => project._id));
    const byProject = new Map();
    const pinnedList = [];
    const recentList = [];

    for (const conversation of safeConversations) {
      const projectId = conversation.projectId
        ? String(conversation.projectId)
        : null;
      const inProject = projectId && projectIds.has(projectId);

      if (conversation.pinned) pinnedList.push(conversation);

      if (inProject) {
        if (!byProject.has(projectId)) byProject.set(projectId, []);
        byProject.get(projectId).push(conversation);
      } else if (!conversation.pinned) {
        recentList.push(conversation);
      }
    }

    return {
      pinnedChats: pinnedList,
      chatsByProject: byProject,
      recentChats: recentList,
    };
  }, [safeConversations, safeProjects]);

  // Load conversations and projects once the user is logged in (the request is
  // unauthorised before that, and would otherwise never be retried).
  useEffect(() => {
    if (!isLoggedIn) return;

    let cancelled = false;

    const load = async () => {
      const [chatList, projectList] = await Promise.all([
        getConversations(),
        fetchProjects(),
      ]);

      if (!cancelled) {
        dispatch(setConversations(Array.isArray(chatList) ? chatList : []));
        dispatch(setProjects(projectList));
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, dispatch]);

  // Esc closes the phone drawer.
  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onMobileClose?.();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onMobileClose]);

  const handleNewChat = async () => {
    closeMobile();

    dispatch(clearSelectedConversation());
    dispatch(clearMessages());

    const data = await createConversation();

    if (data?._id) {
      // addConversation also selects the new conversation.
      dispatch(addConversation(data));
      navigate(`/chat/${data._id}`);
    } else {
      navigate("/");
    }
  };

  const handleSelectConversation = (conversation) => {
    closeMobile();

    // ChatArea reads the id from the URL, selects it and loads its messages.
    navigate(`/chat/${conversation._id}`);
  };

  const handleLogout = async () => {
    closeMobile();

    await logout();

    dispatch(setUserData(null));
    dispatch(setConversations([]));
    dispatch(setProjects([]));
    dispatch(clearSelectedConversation());
    dispatch(clearMessages());

    navigate("/");
  };

  const openBilling = () => {
    closeMobile();
    setShowBilling(true);
  };

  // On the icon rail, a section button first expands the sidebar.
  const toggleSection = (setOpen) => {
    if (collapsed) {
      setCollapsed(false);
      setOpen(true);
    } else {
      setOpen((previous) => !previous);
    }
  };

  // After a chat is pinned or added to a project, open that section.
  const handlePinChange = (isPinned) => {
    if (isPinned) setPinnedOpen(true);
  };

  const handleMoved = (projectId) => {
    if (!projectId) return;

    setProjectsOpen(true);
    setHighlight((previous) => ({ projectId, tick: previous.tick + 1 }));
  };

  const submitNewProject = async () => {
    const name = newProjectName.trim();

    if (!name || savingProject) return;

    setSavingProject(true);
    const project = await createProject(name);
    setSavingProject(false);

    if (project) {
      dispatch(addProject(project));
      setNewProjectName("");
      setCreatingProject(false);
    }
  };

  const userName =
    userData?.displayName || userData?.name || userData?.fullName || "User";

  const userPhoto =
    userData?.photoURL ||
    userData?.photoUrl ||
    userData?.picture ||
    userData?.avatar ||
    "";

  const userInitial = userName.charAt(0).toUpperCase();

  // Plan and credits come from the session (kept up to date by the billing
  // service after a payment).
  const planId = userData?.plan || "free";
  const planName = planId.charAt(0).toUpperCase() + planId.slice(1);

  const credits = typeof userData?.credits === "number" ? userData.credits : null;
  const totalCredits =
    typeof userData?.totalCredits === "number" ? userData.totalCredits : null;

  const creditPercent =
    credits !== null && totalCredits
      ? Math.max(0, Math.min(100, (credits / totalCredits) * 100))
      : 0;

  const selectedId = selectedConversation?._id;

  const renderChat = (conversation) => (
    <ChatRow
      key={conversation._id}
      conversation={conversation}
      selected={selectedId === conversation._id}
      projects={safeProjects}
      collapsed={collapsed}
      labelHidden={labelHidden}
      railCenter={railCenter}
      onSelect={handleSelectConversation}
      onPinChange={handlePinChange}
      onMoved={handleMoved}
    />
  );

  return (
    <>
      {/* Dim the page behind the phone drawer */}
      <div
        aria-hidden="true"
        onClick={closeMobile}
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[280px] max-w-[85vw] flex-col overflow-clip border-r border-[#263247] bg-[#0F172A] transition-[translate,transform,width,visibility] duration-200 ease-out md:static md:z-20 md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none md:visible ${
          mobileOpen
            ? "visible translate-x-0 shadow-2xl shadow-black/50"
            : "invisible -translate-x-full"
        } ${collapsed ? "md:w-[72px]" : "md:w-[270px]"}`}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Header */}
          <div className="flex h-[64px] shrink-0 items-center gap-2.5 border-b border-[#263247] px-4">
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((prev) => !prev)}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-white md:flex"
            >
              <PanelLeftIcon size={18} />
            </button>

            <span
              className={`flex-1 text-[16px] font-semibold tracking-tight text-[#F1F5F9] ${labelHidden}`}
            >
              Atlas<span className="text-[#A78BFA]">AI</span>
            </span>

            <span
              className={`rounded-md border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[10px] font-medium text-violet-300 ${labelHidden}`}
            >
              {planName.toUpperCase()}
            </span>

            <button
              type="button"
              aria-label="New chat"
              onClick={handleNewChat}
              className={`hidden h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-[#A78BFA] ${
                collapsed ? "" : "md:flex"
              }`}
            >
              <SquarePen size={17} />
            </button>

            {/* Phones only: close the drawer */}
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeMobile}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-white md:hidden"
            >
              <X size={18} />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="shrink-0 px-3 pt-5">
            <button
              type="button"
              onClick={handleNewChat}
              aria-label="New Chat"
              className={`flex h-[46px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6366F1] px-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition-all duration-200 hover:brightness-110 active:scale-[0.98] ${
                collapsed ? "md:px-0" : ""
              }`}
            >
              <SquarePen size={18} className="shrink-0" />

              <span className={labelHidden}>New Chat</span>
            </button>
          </div>

          {/* Projects, pinned chats and recent chats */}
          <div className="mt-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-2">
            {/* Projects */}
            <SectionButton
              icon={FolderKanban}
              label="Projects"
              count={safeProjects.length}
              open={projectsOpen && !collapsed}
              onClick={() => toggleSection(setProjectsOpen)}
              labelHidden={labelHidden}
              railCenter={railCenter}
            />

            {projectsOpen && !collapsed && (
              <div className="mb-2 mt-1 space-y-1">
                {creatingProject ? (
                  <div className="flex items-center gap-1.5 px-1">
                    <input
                      autoFocus
                      value={newProjectName}
                      maxLength={60}
                      disabled={savingProject}
                      placeholder="Project name"
                      aria-label="New project name"
                      onChange={(event) => setNewProjectName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitNewProject();
                        if (event.key === "Escape") {
                          setCreatingProject(false);
                          setNewProjectName("");
                        }
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-violet-400/40 bg-[#111A2E] px-3 py-2 text-sm text-[#F1F5F9] outline-none placeholder:text-[#64748B]"
                    />

                    <button
                      type="button"
                      aria-label="Cancel new project"
                      onClick={() => {
                        setCreatingProject(false);
                        setNewProjectName("");
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingProject(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-[#F1F5F9]"
                  >
                    <Plus size={15} className="shrink-0 text-[#A78BFA]" />
                    New project
                  </button>
                )}

                {safeProjects.map((project) => (
                  <ProjectRow
                    key={project._id}
                    project={project}
                    chats={chatsByProject.get(project._id) || NO_CHATS}
                    projects={safeProjects}
                    selectedId={selectedId}
                    highlightTick={
                      highlight.projectId === project._id ? highlight.tick : 0
                    }
                    onSelect={handleSelectConversation}
                    onPinChange={handlePinChange}
                    onMoved={handleMoved}
                  />
                ))}

                {safeProjects.length === 0 && !creatingProject && (
                  <p className="px-3 py-2 text-xs leading-5 text-[#64748B]">
                    No projects yet. Group related chats in a project.
                  </p>
                )}
              </div>
            )}

            {/* Pinned chats */}
            <div className="mt-1">
              <SectionButton
                icon={Pin}
                label="Pinned chats"
                count={pinnedChats.length}
                open={pinnedOpen && !collapsed}
                onClick={() => toggleSection(setPinnedOpen)}
                labelHidden={labelHidden}
                railCenter={railCenter}
              />
            </div>

            {pinnedOpen && !collapsed && (
              <div className="mb-2 mt-1 space-y-1">
                {pinnedChats.length > 0 ? (
                  pinnedChats.map(renderChat)
                ) : (
                  <p className="px-3 py-2 text-xs leading-5 text-[#64748B]">
                    No pinned chats. Open a chat&apos;s menu and choose
                    &quot;Pin chat&quot;.
                  </p>
                )}
              </div>
            )}

            {/* Recent chats */}
            <p
              className={`mb-3 mt-5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B] ${labelHidden}`}
            >
              Recent
            </p>

            <div className="space-y-1">
              {recentChats.length > 0 ? (
                recentChats.map(renderChat)
              ) : (
                <p
                  className={`px-3 py-4 text-center text-sm leading-6 text-[#64748B] ${labelHidden}`}
                >
                  {safeConversations.length > 0
                    ? "No other chats"
                    : "No recent conversations"}
                  <span className="mt-1 block text-xs text-[#475569]">
                    {safeConversations.length > 0
                      ? "Your other chats are in Projects or Pinned"
                      : "Start a new chat to begin"}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Profile */}
          <div className="shrink-0 border-t border-[#263247] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {/* Credits */}
            <button
              type="button"
              onClick={openBilling}
              title={`${credits ?? "—"} credits left · View plans`}
              aria-label="View credits and plans"
              className={`mb-2 flex w-full min-w-0 items-center justify-start gap-2.5 rounded-xl border border-[#263247] bg-[#111A2E] px-3 py-2.5 text-left transition-colors hover:border-violet-400/30 hover:bg-[#1E293B] ${railCenter}`}
            >
              <Coins size={16} className="shrink-0 text-[#A78BFA]" />

              <span className={`min-w-0 flex-1 ${labelHidden}`}>
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-[#F1F5F9]">
                    {credits ?? "—"} credits
                  </span>
                  <span className="shrink-0 text-[#64748B]">{planName}</span>
                </span>

                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[#263247]">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#6366F1] transition-all duration-500"
                    style={{ width: `${creditPercent}%` }}
                  />
                </span>
              </span>
            </button>

            <div
              className={`flex min-w-0 items-center justify-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#1E293B] ${railCenter}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-400/20 bg-[#1E293B]">
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={userName}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-sm font-semibold text-white">
                    {userInitial}
                  </span>
                )}
              </div>

              <div className={`min-w-0 flex-1 ${labelHidden}`}>
                <p className="truncate text-sm font-medium text-[#F1F5F9]">
                  {userName}
                </p>

                <div className="mt-1 text-xs text-[#64748B]">
                  {planName} Plan
                </div>
              </div>

              <div className={`flex items-center gap-1 ${labelHidden}`}>
                <button
                  type="button"
                  aria-label="Credits"
                  title="Credits"
                  onClick={openBilling}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-violet-500/10 hover:text-[#A78BFA] md:h-8 md:w-8"
                >
                  <Coins size={17} />
                </button>

                <button
                  type="button"
                  aria-label="Log out"
                  title="Log out"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-red-500/10 hover:text-red-400 md:h-8 md:w-8"
                  onClick={handleLogout}
                >
                  <LogOut size={17} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <BillingDrawer open={showBilling} onClose={() => setShowBilling(false)} />
      </aside>
    </>
  );
};

export default Sidebar;