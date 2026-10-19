import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Content is centred at 1280px so cards do not stretch edge to edge on a 27" monitor (design §13.5). */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px]", className)}>{children}</div>;
}
