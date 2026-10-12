import { notFound } from "next/navigation";
import { PublicBooking } from "@/features/booking/public-booking";
import { slug } from "@/lib/validation";
import { parsePublicBookingQuery } from "@/lib/public-booking";
export const dynamic = "force-dynamic";
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ organization: string; branch?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await params;
  const preselection = parsePublicBookingQuery(await searchParams);
  if (
    !slug.safeParse(p.organization).success ||
    (p.branch && p.branch.length !== 1) ||
    (p.branch?.[0] && !slug.safeParse(p.branch[0]).success)
  )
    notFound();
  return (
    <main id="content" className="public-page">
      <PublicBooking organization={p.organization} branchSlug={p.branch?.[0]} requestedService={preselection.service} source={preselection.source} />
    </main>
  );
}
