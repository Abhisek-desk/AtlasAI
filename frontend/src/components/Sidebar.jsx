import { PanelLeftIcon, SquarePen, LogOut, Coins } from "lucide-react";
import { useEffect, useState } from "react";
import {getConversations} from "../features/getConversations.js";
import { useDispatch } from "react-redux";
import { setConversations } from "../redux/conversationSlice.js";

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const dispatch = useDispatch();
  useEffect(() => {
    const getConv = async () => {
      const data = await getConversations();
      dispatch(setConversations(data));
    };
    getConv();
  }, []);
  return (
    <div className="fixed inset-y-0 left-0 z-50 h-screen w-[270px] shrink-0 border-r border-white/[0.06] bg-[#0d0f14] lg:static">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-[64px] shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4">
          <button
            type="button"
            aria-label="Toggle sidebar"
            className="hidden h-7 w-7 items-center justify-center rounded-lg bg-transparent text-slate-500 transition-colors duration-150 hover:bg-white/[0.05] hover:text-slate-200 lg:flex"
            onClick={() => {
              setCollapsed(true);
            }}
          >
            <PanelLeftIcon size={18} />
          </button>

          <span className="flex-1 text-[16px] font-semibold tracking-tight text-slate-100">
            AtlasAI
          </span>

          <span className="rounded-md bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-400">
            free
          </span>

          <button
            type="button"
            aria-label="New chat"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
          >
            <SquarePen size={17} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pt-5">
          <button
            type="button"
            className="flex h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-700 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 transition-all hover:brightness-110 active:scale-[0.98]"
          onClick={()=>createConversation()}>
            <SquarePen size={18} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Recent Chats */}
        <div className="mt-7 flex-1 overflow-y-auto px-3">
          <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            Recents
          </p>

          <div className="space-y-1">
            {/* Chat history items will go here */}
          </div>
        </div>

        {/* Bottom Profile Section */}
        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-white/[0.03]">
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#191b24]">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500/50 to-purple-700/50" />
            </div>

            {/* User Details */}
            <div className="min-w-0 flex-1">
              <div className="h-3 w-24 rounded bg-white/[0.08]" />
              <div className="mt-2 h-2 w-16 rounded bg-white/[0.04]" />
            </div>

            {/* Account Actions */}
            <button
              type="button"
              aria-label="Credits"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-violet-400"
            >
              <Coins size={17} />
            </button>

            <button
              type="button"
              aria-label="Log out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
