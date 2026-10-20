import { Plus, MoreHorizontal } from "lucide-react";
import { useSelector } from "react-redux";

const Nav = ({ onNewChat }) => {
  const selectedConversation = useSelector(
    (state) => state.conversation.selectedConversation,
  );

  const messageCount = useSelector((state) => state.message.messages.length);

  if (!selectedConversation) return null;

  const title = selectedConversation.title || selectedConversation.name || "New chat";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-3 sm:px-5 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-gray-100">
              {title}
            </h2>

            <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-400">
              {messageCount} {messageCount === 1 ? "message" : "messages"}
            </span>
          </div>

          <p className="text-[11px] text-gray-500">AtlasAI</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 transition hover:bg-white/10"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New chat</span>
        </button>

        <button
          type="button"
          title="More options"
          className="rounded-xl p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </header>
  );
};

export default Nav;