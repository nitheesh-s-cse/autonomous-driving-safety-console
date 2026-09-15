import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export function Panel({
  children,
  className,
  title,
  right,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  right?: ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[12px] border border-white/[0.08] bg-[#0b1016]",
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A7B0BA]">{title}</h2>
          {right}
        </div>
      )}
      <div className={cn("flex-1 min-h-0", padded && "p-4")}>{children}</div>
    </div>
  );
}

export function Divider({ vertical = false }: { vertical?: boolean }) {
  return <div className={cn("bg-white/[0.08]", vertical ? "w-px self-stretch" : "h-px w-full")} />;
}
