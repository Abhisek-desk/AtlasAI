import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 232;

// A small floating menu. It is drawn on top of the whole page (portal) so the
// sidebar's scroll area can't clip it. It closes on outside click or Esc, and
// follows its button when the page resizes or scrolls (it does not close then,
// because a phone's keyboard also triggers resize/scroll).
const PopupMenu = ({ anchorRef, open, onClose, children }) => {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);

  const place = useCallback(() => {
    if (!anchorRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight || 220;

    const left = Math.max(
      8,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
    );

    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 6);
    }

    setPosition((previous) =>
      previous && previous.top === top && previous.left === left
        ? previous
        : { top, left },
    );
  }, [anchorRef]);

  // Runs after every render while open, so the menu also adjusts when its
  // content changes size.
  useLayoutEffect(() => {
    if (open) place();
  });

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const insideMenuOrButton = (target) =>
      menuRef.current?.contains(target) || anchorRef.current?.contains(target);

    const onMouseDown = (event) => {
      if (!insideMenuOrButton(event.target)) onClose();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    // Scrolling inside the menu (long project list) needs no re-placing.
    const onScroll = (event) => {
      if (!menuRef.current?.contains(event.target)) place();
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onClose, anchorRef, place]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: MENU_WIDTH,
        visibility: position ? "visible" : "hidden",
      }}
      className="z-[60] rounded-xl border border-[#263247] bg-[#0F172A] p-1.5 text-sm text-[#CBD5E1] shadow-2xl shadow-black/50"
    >
      {children}
    </div>,
    document.body,
  );
};

export const MenuItem = ({
  icon: Icon,
  children,
  onClick,
  danger = false,
  disabled = false,
  trailing = null,
}) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onClick}
    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      danger
        ? "text-red-400 hover:bg-red-500/10"
        : "hover:bg-[#1E293B] hover:text-white"
    }`}
  >
    {Icon && <Icon size={15} className="shrink-0" />}
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {trailing}
  </button>
);

export const MenuDivider = () => (
  <div className="my-1 h-px bg-[#263247]" role="separator" />
);

export default PopupMenu;