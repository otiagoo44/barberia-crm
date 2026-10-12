import { notFound } from "next/navigation";
import { PublicBooking } from "@/features/booking/public-booking";
import { slug } from "@/lib/validation";
export const dynamic = "force-dynamic";
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ organization: string; branch?: string[] }>;
  searchParams: Promise<{service?:string|string[];source?:string|string[]}>;
}) {
  const p = await params;
  const q = await searchParams;
  const requestedService=typeof q.service==='string'&&slug.safeParse(q.service).success?q.service:undefined;
  if (
    !slug.safeParse(p.organization).success ||
    (p.branch && p.branch.length !== 1) ||
    (p.branch?.[0] && !slug.safeParse(p.branch[0]).success)
  )
    notFound();
  return (
    <main id="content" className="public-page">
      <PublicBooking organization={p.organization} branchSlug={p.branch?.[0]} requestedService={requestedService} />
    </main>
  );
}
