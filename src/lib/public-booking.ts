import { slug } from "./validation";
import { nextServiceSelection, type PickableService } from "../features/services/service-picker";

export type PublicPickableService = PickableService & {
  consultation_required: boolean;
  website_category?: string | null;
};
export function parsePublicBookingQuery(query: Record<string, string | string[] | undefined>) {
  return {
    service: typeof query.service === "string" && slug.safeParse(query.service).success ? query.service : undefined,
    source: query.source === "website" ? "website" as const : undefined,
  };
}
export function directlyBookable(service: PublicPickableService) {
  return service.consultation_required === false && service.website_category !== "rulos";
}
export function preselectedServices(all: PublicPickableService[], requested?: string): string[] {
  const permitted = all.filter(directlyBookable);
  const service = permitted.find(s => s.id === requested);
  if (!service || (service.composition_mode !== "standalone" && !service.base_service_id)) return [];
  return nextServiceSelection([], service, permitted);
}
