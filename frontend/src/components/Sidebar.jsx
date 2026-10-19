import {
  PanelLeftIcon,
  SquarePen,
  LogOut,
  Coins,
  MessageSquare,
} from "lucide-react";

import { useEffect, useState } from "react";
import { getConversations } from "../features/getConversations.js";
import { useDispatch, useSelector } from "react-redux";

import {
  addConversation,
  setConversations,
  selectConversation,
  clearSelectedConversation,
} from "../redux/conversationSlice.js";

import { createConversation } from "../features/createConversation.js";
import logout from "../features/logout.js";
import { setUserData } from "../redux/userSlice.js";

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);

  const dispatch = useDispatch();

  const { conversations, selectedConversation } = useSelector(
    (state) => state.conversation,
  );

  const userData = useSelector((state) => state.user?.userData);

  useEffect(() => {
    const getConv = async () => {
      const data = await getConversations();

      dispatch(setConversations(Array.isArray(data) ? data : []));
    };

    getConv();
  }, [dispatch]);

  const handleCreateConv = async () => {
    const data = await createConversation();

    if (data) {
      dispatch(addConversation(data));
    }
  };

  const handleNewChat = async () => {
    dispatch(clearSelectedConversation());
    await handleCreateConv();
  };

  const userName =
    userData?.displayName ||
    userData?.name ||
    userData?.fullName ||
    "User";

  const userEmail = userData?.email || "No email available";

  const userPhoto =
    userData?.photoURL ||
    userData?.photoUrl ||
    userData?.picture ||
    userData?.avatar ||
    "";

  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div
      className={`relative z-20 flex h-dvh shrink-0 flex-col overflow-hidden border-r border-[#263247] bg-[#0F172A] transition-all duration-200 ${
        collapsed ? "w-[72px]" : "w-[270px]"
      }`}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="flex h-[64px] shrink-0 items-center gap-2.5 border-b border-[#263247] px-4">
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-white"
          >
            <PanelLeftIcon size={18} />
          </button>

          {!collapsed && (
            <>
              <span className="flex-1 text-[16px] font-semibold tracking-tight text-[#F1F5F9]">
                Atlas<span className="text-[#A78BFA]">AI</span>
              </span>

              <span className="rounded-md border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[10px] font-medium text-violet-300">
                FREE
              </span>

              <button
                type="button"
                aria-label="New chat"
                onClick={handleNewChat}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-[#A78BFA]"
              >
                <SquarePen size={17} />
              </button>
            </>
          )}
        </div>

        {/* New Chat Button */}
        <div className="shrink-0 px-3 pt-5">
          <button
            type="button"
            onClick={handleNewChat}
            aria-label="New Chat"
            className={`flex h-[46px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition-all duration-200 hover:brightness-110 active:scale-[0.98] ${
              collapsed ? "px-0" : "px-3"
            }`}
          >
            <SquarePen size={18} className="shrink-0" />

            {!collapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Recent Chats */}
        <div className="mt-7 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3">
          {!collapsed && (
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
              Recent
            </p>
          )}

          <div className="space-y-1">
            {Array.isArray(conversations) && conversations.length > 0
              ? conversations.map((conversation) => (
                  <button
                    key={conversation._id}
                    type="button"
                    title={conversation.title || "New Chat"}
                    onClick={() => dispatch(selectConversation(conversation))}
                    className={`group flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-150 ${
                      selectedConversation?._id === conversation._id
                        ? "border-violet-400/15 bg-violet-500/10 text-violet-200"
                        : "border-transparent text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F1F5F9]"
                    }`}
                  >
                    <MessageSquare
                      size={16}
                      className={`shrink-0 ${
                        selectedConversation?._id === conversation._id
                          ? "text-[#A78BFA]"
                          : "text-[#64748B] group-hover:text-[#A78BFA]"
                      }`}
                    />

                    {!collapsed && (
                      <span className="truncate">
                        {conversation.title || "New Chat"}
                      </span>
                    )}
                  </button>
                ))
              : !collapsed && (
                  <p className="px-3 py-4 text-center text-sm leading-6 text-[#64748B]">
                    No recent conversations
                    <span className="mt-1 block text-xs text-[#475569]">
                      Start a new chat to begin
                    </span>
                  </p>
                )}
          </div>
        </div>

        {/* Profile */}
        <div className="shrink-0 border-t border-[#263247] p-3">
          <div
            className={`flex min-w-0 items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#1E293B] ${
              collapsed ? "justify-center" : ""
            }`}
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

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#F1F5F9]">
                  {userName}
                </p>

                <div className="mt-1 text-xs text-[#64748B]">
                  Free Plan
                </div>
              </div>
            )}

            {!collapsed && (
              <>
                <button
                  type="button"
                  aria-label="Credits"
                  title="Credits"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-violet-500/10 hover:text-[#A78BFA]"
                >
                  <Coins size={17} />
                </button>

                <button
                  type="button"
                  aria-label="Log out"
                  title="Log out"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-red-500/10 hover:text-red-400"
                  onClick={() => {
                    logout();
                    dispatch(setUserData(null));
                  }}
                >
                  <LogOut size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;