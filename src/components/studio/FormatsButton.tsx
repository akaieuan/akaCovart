"use client";

import { LayoutGrid } from "lucide-react";

import { useStudio } from "@/lib/store";
import { getFormat } from "@/lib/formats";
import { cn } from "@/lib/utils";

/** Secondary button that opens the multi-format bento overlay. */
export function FormatsButton({ className }: { className?: string }) {
  const format = useStudio((s) => s.format);
  const setState = useStudio((s) => s.setState);
  const f = getFormat(format);

  return (
    <button
      type="button"
      onClick={() => setState({ showFormats: true })}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-[9px] rounded-[4px] border border-grey-700 bg-grey-900 text-[12px] font-normal text-grey-150 transition-colors hover:border-grey-600 hover:bg-grey-850 hover:text-white",
        className,
      )}
    >
      <LayoutGrid className="size-[14px]" />
      Formats
      <span className="text-grey-400">· {f.label}</span>
    </button>
  );
}
