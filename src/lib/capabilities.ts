import type { Role } from "./types";

// Stable product capabilities. Server callers supply roles from live memberships.
// This catalog does not replace record scope, active membership, RLS or RPC guards.
export const capabilities = {
  "finance.import": ["organization_owner", "finance"],
  "finance.configure": ["organization_owner", "finance"],
  "organization.configure": ["organization_owner"],
  "operations.manage": ["organization_owner", "manager"],
} as const satisfies Record<string, readonly Role[]>;

export function hasCapability(
  role: string | undefined,
  capability: keyof typeof capabilities,
) {
  return (
    !!role && (capabilities[capability] as readonly string[]).includes(role)
  );
}
