import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { WorkspaceProvider } from "@/features/organizations/context";
import { Shell } from "@/components/shell";
import type { Organization, Branch, Role } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organization: string }>;
}) {
  let context;
  try {
    context = await requireUser();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    redirect("/");
  }
  const { organization: slug } = await params;
  const { db, user, profile } = context;
  const { data: organization } = await db
    .from("organizations")
    .select("id,name,slug,timezone,currency,brand_color,logo_url")
    .eq("slug", slug)
    .single();
  if (!organization) notFound();
  const [{ data: branches }, { data: membership }, { data: session }] =
    await Promise.all([
      db
        .from("branches")
        .select("id,name,slug,timezone,active")
        .eq("organization_id", organization.id)
        .eq("active", true)
        .order("name")
        .limit(100),
      db
        .from("organization_memberships")
        .select("role")
        .eq("organization_id", organization.id)
        .eq("profile_id", user.id)
        .eq("active", true)
        .maybeSingle(),
      db.rpc("session_context"),
    ]);
  const platformAdmin = !!session?.platform_admin;
  if (!membership && !platformAdmin) notFound();
  const ownStaff =
    (
      session?.staff as { organization_id: string; id: string }[] | undefined
    )?.find((s) => s.organization_id === organization.id)?.id ?? null;
  return (
    <WorkspaceProvider
      key={organization.id}
      workspace={{
        organization: organization as Organization,
        branches: (branches ?? []) as Branch[],
        role: platformAdmin ? "platform_admin" : (membership!.role as Role),
        profileId: user.id,
        fullName: profile.full_name,
        platformAdmin,
        staffId: ownStaff,
      }}
    >
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
