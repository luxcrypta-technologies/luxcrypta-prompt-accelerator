import type { ReactNode } from "react";

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="ui-action-bar">{children}</div>;
}
