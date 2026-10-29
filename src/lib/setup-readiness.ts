export type SetupTeamPerson = {
  name: string;
  assigned: boolean;
  linked: boolean;
  membership: boolean;
  email_confirmed: boolean;
  capabilities: number;
  verified_factors: number;
  password_change_required?: boolean;
  mfa_required?: boolean;
};
export function professionalConfigured(person: SetupTeamPerson) {
  return person.assigned && person.capabilities > 0;
}
export function professionalAccessReady(person: SetupTeamPerson) {
  return (
    professionalConfigured(person) &&
    person.linked &&
    person.membership &&
    person.email_confirmed &&
    person.password_change_required === false &&
    (person.mfa_required === false || person.verified_factors >= 1)
  );
}
export type PublicBookingObservation = {
  catalog: boolean;
  availability: boolean;
  failed: boolean;
};
export async function observePublicBooking(
  origin: string,
  organization: string,
  branch: string,
  day: string,
  request: typeof fetch = fetch,
): Promise<PublicBookingObservation> {
  try {
    const base = new URL(origin);
    if (
      base.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(base.hostname)
    )
      throw new Error("invalid_origin");
    const url = new URL("/api/public/catalog", base);
    url.search = new URLSearchParams({ organization, branch }).toString();
    const catalogResponse = await request(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      cache: "no-store",
    });
    if (
      !catalogResponse.ok ||
      !catalogResponse.headers.get("content-type")?.includes("application/json")
    )
      return { catalog: false, availability: false, failed: true };
    const catalog = await catalogResponse.json();
    const local = catalog.branches?.find(
      (b: { slug: string }) => b.slug === branch,
    );
    const valid =
      catalog.slug === organization &&
      catalog.website_booking_version === 1 &&
      local &&
      Array.isArray(local.services) &&
      Array.isArray(local.staff) &&
      local.staff.length > 0;
    if (!valid) return { catalog: false, availability: false, failed: true };
    const service = local.services.find(
      (s: {
        slug: string;
        consultation_required: boolean;
        composition_mode: string;
      }) =>
        s.consultation_required === false &&
        s.composition_mode === "standalone" &&
        /^[a-z0-9][a-z0-9-]{1,62}$/.test(s.slug),
    );
    if (!service) return { catalog: true, availability: false, failed: false };
    const availabilityUrl = new URL("/api/public/availability", base);
    availabilityUrl.search = new URLSearchParams({
      organization,
      branch,
      service: service.slug,
      date: day,
    }).toString();
    const availability = await request(availabilityUrl, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      cache: "no-store",
    });
    const validAvailability =
      availability.ok &&
      availability.headers.get("content-type")?.includes("application/json") &&
      Array.isArray(await availability.json());
    return {
      catalog: true,
      availability: Boolean(validAvailability),
      failed: !validAvailability,
    };
  } catch {
    return { catalog: false, availability: false, failed: true };
  }
}
