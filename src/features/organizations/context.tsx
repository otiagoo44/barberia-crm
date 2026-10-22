"use client";
import {
  createContext,
  useContext,
  useState,
  Profiler,
  type ReactNode,
} from "react";
import type { Workspace } from "@/lib/types";
import { ResourceScope } from "@/lib/client";
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
  const content = (
    <ResourceScope.Provider
      value={JSON.stringify([
        workspace.profileId,
        workspace.organization.id,
        workspace.role,
        branchId,
      ])}
    >
      <Context.Provider value={{ ...workspace, branchId, setBranchId }}>
        {children}
      </Context.Provider>
    </ResourceScope.Provider>
  );
  return process.env.NEXT_PUBLIC_QA_PROFILE === "1" ? (
    <Profiler
      id="workspace"
      onRender={(
        _id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      ) => {
        window.dispatchEvent(
          new CustomEvent("barberia:profile", {
            detail: {
              phase,
              actualDuration,
              baseDuration,
              startTime,
              commitTime,
            },
          }),
        );
      }}
    >
      {content}
    </Profiler>
  ) : (
    content
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("workspace_required");
  return value;
}
