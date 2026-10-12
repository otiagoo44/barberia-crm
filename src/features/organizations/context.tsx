"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Workspace } from "@/lib/types";
type Context = Workspace & {
  branchId: string;
  setBranchId: (id: string) => void;
};
const Context = createContext<Context | null>(null);
export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const [branchId, setBranchId] = useState(workspace.branches[0]?.id ?? "");
  return (
    <Context.Provider value={{ ...workspace, branchId, setBranchId }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("workspace_required");
  return value;
}
