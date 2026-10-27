import { Plus, MoreHorizontal, Menu } from "lucide-react";
import { useSelector } from "react-redux";

// Opens the sidebar drawer on phones; hidden from md up, where the sidebar is
// always visible.
const MenuButton = ({ onClick }) => {
  // Fallback no-op function if onClick is not a function
  const handleClick = typeof onClick === "function" ? onClick : () => {};

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Open menu"
      className="-ml-1 shrink-0 rounded-xl p-2 text-gray-300 transition hover:bg-white/10 hover:text-white md:hidden"
    >
      <Menu size={20} />
    </button>
  );
};

const Nav = ({ onNewChat, onMenuClick, onMoreClick }) => {
  const selectedConversation = useSelector(
    (state) => state.conversation.selectedConversation,
  );

  const messageCount = useSelector((state) => state.message.messages.length);

  // Safe handlers to prevent object/undefined crashes
  const handleNewChat = typeof onNewChat === "function" ? onNewChat : () => {};
  const handleMenuClick = typeof onMenuClick === "function" ? onMenuClick : () => {};
  const handleMoreClick = typeof onMoreClick === "function" ? onMoreClick : () => {};

  // No conversation yet: only phones need a bar, to reach the sidebar.
  if (!selectedConversation) {
    return (
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/5 px-3 md:hidden">
        <MenuButton onClick={handleMenuClick} />

        <span className="text-[15px] font-semibold tracking-tight text-gray-100">
          Atlas<span className="text-[#A78BFA]">AI</span>
        </span>
      </header>
    );
  }

  const title = selectedConversation.title || selectedConversation.name || "New chat";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 sm:px-5 md:h-16 lg:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <MenuButton onClick={handleMenuClick} />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-gray-100">
              {title}
            </h2>

            <span className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-400 sm:inline">
              {messageCount} {messageCount === 1 ? "message" : "messages"}
            </span>
          </div>

          <p className="text-[11px] text-gray-500">AtlasAI</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleNewChat}
          aria-label="New chat"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 transition hover:bg-white/10"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New chat</span>
        </button>

        <button
          type="button"
          onClick={handleMoreClick}
          title="More options"
          aria-label="More options"
          className="rounded-xl p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </header>
  );
};

export default Nav;