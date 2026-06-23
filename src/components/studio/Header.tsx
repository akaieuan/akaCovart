"use client";

import { Eye, LayoutGrid, SlidersHorizontal } from "lucide-react";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Transparent floating header. Wordmark (click → home) on the left, a glassy
 * nav pill on the right with three EQUAL view tabs:
 *  - Edit    → the editor (closes any overlay).
 *  - Formats → the multi-format bento.
 *  - Preview → the still + motion preview page.
 * Exactly one is active. (Collapsing the sidebar is a separate handle on the
 * panel itself, so these three stay consistent view switchers.)
 */
export default function Header({ onHome }: { onHome?: () => void }) {
  const showFormats = useStudio((s) => s.showFormats);
  const showPreview = useStudio((s) => s.showPreview);
  const setState = useStudio((s) => s.setState);

  const view = showFormats ? "formats" : showPreview ? "preview" : "edit";

  const goEdit = () => setState({ showFormats: false, showPreview: false });
  const goFormats = () => setState({ showFormats: true, showPreview: false });
  const goPreview = () => setState({ showPreview: true, showFormats: false });

  const items = [
    { key: "edit", label: "Edit", Icon: SlidersHorizontal, onClick: goEdit, active: view === "edit" },
    { key: "formats", label: "Formats", Icon: LayoutGrid, onClick: goFormats, active: view === "formats" },
    { key: "preview", label: "Preview", Icon: Eye, onClick: goPreview, active: view === "preview" },
  ];

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5">
      <button
        type="button"
        onClick={onHome}
        aria-label="Back to start"
        className="pointer-events-auto inline-flex cursor-pointer items-baseline select-none transition-opacity hover:opacity-70"
      >
        <span className="text-[15px] font-light text-grey-350">aka</span>
        <span className="text-[15px] font-semibold text-grey-100">COVART</span>
      </button>

      <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-panel/70 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {items.map(({ key, label, Icon, onClick, active }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors",
              active
                ? "bg-grey-100 text-bg"
                : "text-grey-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-[14px]" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
