import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, response, readJson, HttpError, correlationId } from "@/lib/http";
import { uuid, date, slug, customerInput, statuses } from "@/lib/validation";
export const dynamic = "force-dynamic";
const nullableId = uuid.nullable();
const common = { org: uuid, branch: nullableId };
const writes = {
  record: z
    .object({
      ...common,
      entity: z.string().min(1).max(60),
      id: nullableId,
      data: z.record(z.string(), z.unknown()),
    })
    .strict(),
  organization: z
    .object({ org: uuid, data: z.record(z.string(), z.unknown()) })
    .strict(),
  create_organization: z
    .object({
      name: z.string().trim().min(1).max(120),
      slug,
      timezone: z.string().max(80),
      currency: z.string().regex(/^[A-Z]{3}$/),
      owner_email: z.email(),
    })
    .strict(),
  membership: z
    .object({
      org: uuid,
      email: z.email(),
      role: z.enum([
        "organization_owner",
        "manager",
        "receptionist",
        "barber",
        "finance",
      ]),
      all_branches: z.boolean(),
      branches: z.array(uuid).max(100),
      active: z.boolean(),
    })
    .strict(),
  booking: z
    .object({
      ...common,
      branch: uuid,
      services: z.array(uuid).min(1).max(12),
      staff: nullableId,
      starts_at: z.iso.datetime({ offset: true }),
      customer: nullableId,
      customer_data: customerInput.nullable(),
      key: uuid,
      rebooked_from: nullableId,
    })
    .strict(),
  reschedule: z
    .object({
      ...common,
      branch: uuid,
      id: uuid,
      staff: nullableId,
      starts_at: z.iso.datetime({ offset: true }),
      services: z.array(uuid).min(1).max(12),
      key: uuid,
    })
    .strict(),
  transition: z
    .object({
      org: uuid,
      id: uuid,
      status: z.enum(statuses),
      key: uuid,
      reason: z.string().max(300).nullable(),
    })
    .strict(),
  walkin: z
    .object({
      ...common,
      branch: uuid,
      customer: nullableId,
      customer_data: customerInput.nullable(),
      services: z.array(uuid).min(1).max(12),
      preferred_staff: nullableId,
      key: uuid,
    })
    .strict(),
  assign_walkin: z
    .object({
      org: uuid,
      id: uuid,
      staff: nullableId,
      starts_at: z.iso.datetime({ offset: true }),
      key: uuid,
    })
    .strict(),
  close_walkin: z
    .object({
      org: uuid,
      id: uuid,
      status: z.enum(["cancelled", "left"]),
      key: uuid,
    })
    .strict(),
  remove_schedule: z
    .object({
      org: uuid,
      entity: z.enum([
        "branch_business_hours",
        "staff_availability_rules",
        "staff_availability_exceptions",
        "staff_service_capabilities",
      ]),
      id: uuid,
    })
    .strict(),
};
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const requestId = correlationId(request);
  try {
    const { db } = await requireUser();
    const { resource } = await params;
    const raw = await readJson(request);
    let name: string;
    let args: Record<string, unknown>;
    switch (resource) {
      case "daily_blocks": {
        const p = z
          .object({
            org: uuid,
            branch: uuid,
            staff: uuid,
            date,
            blocks: z
              .array(
                z
                  .object({
                    starts_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
                    ends_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
                    available: z.boolean(),
                    reason: z.string().max(300).optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(16),
            key: uuid,
          })
          .strict()
          .parse(raw);
        name = "save_daily_blocks";
        args = {
          p_org: p.org,
          p_branch: p.branch,
          p_staff: p.staff,
          p_date: p.date,
          p_blocks: p.blocks,
          p_key: p.key,
        };
        break;
      }
      case "record": {
        const p = writes.record.parse(raw);
        name = "manage_record";
        args = {
          p_org: p.org,
          p_entity: p.entity,
          p_id: p.id,
          p_branch: p.branch,
          p_data: p.data,
        };
        break;
      }
      case "organization": {
        const p = writes.organization.parse(raw);
        name = "update_organization";
        args = { p_org: p.org, p_data: p.data };
        break;
      }
      case "create_organization": {
        const p = writes.create_organization.parse(raw);
        name = "create_organization_for_email";
        args = {
          p_name: p.name,
          p_slug: p.slug,
          p_timezone: p.timezone,
          p_currency: p.currency,
          p_owner_email: p.owner_email,
        };
        break;
      }
      case "membership": {
        const p = writes.membership.parse(raw);
        name = "manage_membership";
        args = {
          p_org: p.org,
          p_email: p.email,
          p_role: p.role,
          p_all_branches: p.all_branches,
          p_branches: p.branches,
          p_active: p.active,
        };
        break;
      }
      case "booking": {
        const p = writes.booking.parse(raw);
        name = "create_booking";
        args = {
          p_org: p.org,
          p_branch: p.branch,
          p_services: p.services,
          p_staff: p.staff,
          p_start: p.starts_at,
          p_customer: p.customer,
          p_customer_data: p.customer_data,
          p_key: p.key,
          p_rebooked_from: p.rebooked_from,
        };
        break;
      }
      case "reschedule": {
        const p = writes.reschedule.parse(raw);
        name = "reschedule_booking";
        args = {
          p_org: p.org,
          p_id: p.id,
          p_branch: p.branch,
          p_staff: p.staff,
          p_start: p.starts_at,
          p_services: p.services,
          p_key: p.key,
        };
        break;
      }
      case "transition": {
        const p = writes.transition.parse(raw);
        name = "transition_booking";
        args = {
          p_org: p.org,
          p_id: p.id,
          p_status: p.status,
          p_key: p.key,
          p_reason: p.reason,
        };
        break;
      }
      case "walkin": {
        const p = writes.walkin.parse(raw);
        name = "create_walkin";
        args = {
          p_org: p.org,
          p_branch: p.branch,
          p_customer: p.customer,
          p_customer_data: p.customer_data,
          p_services: p.services,
          p_preferred_staff: p.preferred_staff,
          p_key: p.key,
        };
        break;
      }
      case "assign_walkin": {
        const p = writes.assign_walkin.parse(raw);
        name = "assign_walkin";
        args = {
          p_org: p.org,
          p_id: p.id,
          p_staff: p.staff,
          p_start: p.starts_at,
          p_key: p.key,
        };
        break;
      }
      case "close_walkin": {
        const p = writes.close_walkin.parse(raw);
        name = "close_walkin";
        args = { p_org: p.org, p_id: p.id, p_status: p.status, p_key: p.key };
        break;
      }
      case "remove_schedule": {
        const p = writes.remove_schedule.parse(raw);
        name = "remove_schedule_record";
        args = { p_org: p.org, p_entity: p.entity, p_id: p.id };
        break;
      }
      default:
        throw new HttpError(404, "not_found");
    }
    const { data, error } = await db.rpc(name, args);
    if (error) throw error;
    return response(data, requestId);
  } catch (error) {
    return fail(error, requestId);
  }
}
const tables = new Set([
  "branches",
  "staff",
  "services",
  "branch_services",
  "organization_settings",
  "branch_settings",
  "branch_business_hours",
  "branch_closures",
  "staff_branch_assignments",
  "staff_service_capabilities",
  "staff_availability_rules",
  "staff_availability_exceptions",
  "staff_time_off",
  "organization_memberships",
  "membership_branch_access",
  "goals",
  "notifications",
  "audit_logs",
]);
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const requestId = correlationId(request);
  try {
    const { db } = await requireUser();
    const { resource } = await params;
    const q = new URL(request.url).searchParams;
    const org = uuid.parse(q.get("org"));
    const branch = q.get("branch") ? uuid.parse(q.get("branch")) : null;
    const staff = q.get("staff") ? uuid.parse(q.get("staff")) : null;
    if (resource === "calendar_blocks") {
      if (!branch) throw new HttpError(400, "branch_required");
      const startDay = date.parse(q.get("start_day")),
        endDay = date.parse(q.get("end_day"));
      const from = z.iso.datetime({ offset: true }).parse(q.get("from")),
        to = z.iso.datetime({ offset: true }).parse(q.get("to"));
      const duration = Date.parse(to) - Date.parse(from);
      if (
        duration <= 0 ||
        duration > 8 * 86400000 ||
        endDay <= startDay ||
        Date.parse(endDay) - Date.parse(startDay) > 8 * 86400000
      )
        throw new HttpError(400, "calendar_range_exceeded");
      let daily = db
        .from("staff_availability_exceptions")
        .select("id,staff_id,local_date,starts_at,ends_at,available,reason")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .gte("local_date", startDay)
        .lt("local_date", endDay)
        .order("starts_at")
        .limit(1001);
      let absence = db
        .from("staff_time_off")
        .select("id,staff_id,starts_at,ends_at")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .lt("starts_at", to)
        .gt("ends_at", from)
        .order("starts_at")
        .limit(1001);
      if (staff) {
        daily = daily.eq("staff_id", staff);
        absence = absence.eq("staff_id", staff);
      }
      const [blocks, timeOff] = await Promise.all([daily, absence]);
      if (blocks.error) throw blocks.error;
      if (timeOff.error) throw timeOff.error;
      return response(
        {
          items: (blocks.data ?? []).slice(0, 1000),
          absences: (timeOff.data ?? []).slice(0, 1000),
          has_more:
            (blocks.data?.length ?? 0) > 1000 ||
            (timeOff.data?.length ?? 0) > 1000,
        },
        requestId,
      );
    }
    if (resource === "daily_availability") {
      if (!branch) throw new HttpError(400, "branch_required");
      const day = date.parse(q.get("date"));
      const { data, error } = await db
        .from("staff_availability_exceptions")
        .select("id,staff_id,local_date,starts_at,ends_at,available,reason")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .eq("local_date", day)
        .order("starts_at")
        .limit(200);
      if (error) throw error;
      return response({ items: data ?? [] }, requestId);
    }
    let name: string;
    let args: Record<string, unknown>;
    switch (resource) {
      case "maintenance":
        name = "maintenance_due";
        args = {
          p_org: org,
          p_branch: branch,
          p_cursor: q.get("cursor")
            ? z
                .object({
                  id: uuid,
                  expected_return_at: z.iso.datetime({ offset: true }),
                })
                .strict()
                .parse(JSON.parse(q.get("cursor")!))
            : null,
        };
        break;
      case "organization_memberships":
        name = "list_memberships";
        args = {
          p_org: org,
          p_cursor: q.get("cursor")
            ? z
                .object({
                  id: uuid,
                  created_at: z.iso.datetime({ offset: true }),
                })
                .strict()
                .parse(JSON.parse(q.get("cursor")!))
            : null,
        };
        break;
      case "customers":
        name = "customer_list_view";
        args = {
          p_org: org,
          p_branch: branch,
          p_query: z
            .string()
            .max(80)
            .parse(q.get("q") ?? ""),
          p_cursor: q.get("cursor")
            ? z
                .object({
                  id: uuid,
                  created_at: z.iso.datetime({ offset: true }),
                })
                .parse(JSON.parse(q.get("cursor")!))
            : null,
          p_limit: 50,
          p_retention: z
            .enum(["all", "archived", "due_soon", "due", "overdue", "lapsed"])
            .parse(q.get("retention") ?? "all"),
        };
        break;
      case "customer": {
        const customer = uuid.parse(q.get("id"));
        const detail = await db.rpc("customer_detail", {
          p_org: org,
          p_customer: customer,
        });
        if (detail.error) throw detail.error;
        // Session-bound client: the same record/branch RLS applies here.
        // Never expose prices, commissions, private notes or ledger fields.
        const upcoming = await db
          .from("appointments")
          .select(
            "id,branch_id,staff_id,starts_at,ends_at,status,duration_minutes",
          )
          .eq("organization_id", org)
          .eq("customer_id", customer)
          .in("status", ["scheduled", "confirmed", "checked_in", "in_service"])
          .gte("ends_at", new Date().toISOString())
          .order("starts_at")
          .limit(10);
        if (upcoming.error) throw upcoming.error;
        return response(
          { ...detail.data, upcoming: upcoming.data ?? [] },
          requestId,
        );
      }
      case "timeline":
        name = "customer_timeline";
        args = {
          p_org: org,
          p_customer: uuid.parse(q.get("id")),
          p_before: q.get("before")
            ? z.iso.datetime({ offset: true }).parse(q.get("before"))
            : null,
          p_before_id: q.get("before_id")
            ? uuid.parse(q.get("before_id"))
            : null,
          p_limit: 30,
        };
        break;
      case "agenda":
        name = "list_agenda";
        args = {
          p_org: org,
          p_branch: uuid.parse(branch),
          p_staff: staff,
          p_service: q.get("service") ? uuid.parse(q.get("service")) : null,
          p_status: q.get("status")
            ? z.enum(statuses).parse(q.get("status"))
            : null,
          p_from: z.iso.datetime({ offset: true }).parse(q.get("from")),
          p_to: z.iso.datetime({ offset: true }).parse(q.get("to")),
        };
        break;
      case "appointment":
        name = "appointment_detail";
        args = { p_org: org, p_id: uuid.parse(q.get("id")) };
        break;
      case "availability":
        name = "list_availability";
        args = {
          p_org: org,
          p_branch: uuid.parse(branch),
          p_staff: staff,
          p_services: z.array(uuid).min(1).max(12).parse(q.getAll("service")),
          p_date: date.parse(q.get("date")),
        };
        break;
      case "day":
        name = "day_status";
        args = { p_org: org, p_branch: uuid.parse(branch) };
        break;
      case "dashboard":
        name = "dashboard";
        args = {
          p_org: org,
          p_branch: branch,
          p_staff: staff,
          p_from: date.parse(q.get("from")),
          p_to: date.parse(q.get("to")),
        };
        break;
      case "goal_progress":
        name = "goal_progress";
        args = { p_org: org, p_id: uuid.parse(q.get("id")) };
        break;
      case "search":
        name = "search_workspace";
        args = {
          p_org: org,
          p_query: z.string().min(2).max(80).parse(q.get("q")),
        };
        break;
      default: {
        if (!tables.has(resource)) throw new HttpError(404, "not_found");
        let query = db
          .from(resource)
          .select("*")
          .eq("organization_id", org)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(101);
        if (
          branch &&
          resource !== "branches" &&
          resource !== "staff" &&
          resource !== "services" &&
          resource !== "organization_settings" &&
          resource !== "organization_memberships"
        )
          query = query.eq("branch_id", branch);
        if (
          staff &&
          [
            "staff_branch_assignments",
            "staff_service_capabilities",
            "staff_availability_rules",
            "staff_availability_exceptions",
            "staff_time_off",
          ].includes(resource)
        )
          query = query.eq("staff_id", staff);
        const cursor = q.get("cursor");
        if (cursor) {
          const c = z
            .object({ id: uuid, created_at: z.iso.datetime({ offset: true }) })
            .parse(JSON.parse(cursor));
          query = query.or(
            `created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`,
          );
        }
        const { data, error } = await query;
        if (error) throw error;
        const items = (data ?? []).slice(0, 100);
        if (
          items.length &&
          items.some((row) => row.staff_id || row.service_id)
        ) {
          const staffIds = [
            ...new Set(items.map((row) => row.staff_id).filter(Boolean)),
          ];
          const serviceIds = [
            ...new Set(items.map((row) => row.service_id).filter(Boolean)),
          ];
          const [people, services] = await Promise.all([
            staffIds.length
              ? db.from("staff").select("id,name").in("id", staffIds)
              : Promise.resolve({ data: [] }),
            serviceIds.length
              ? db.from("services").select("id,name").in("id", serviceIds)
              : Promise.resolve({ data: [] }),
          ]);
          for (const row of items) {
            row.staff_name = people.data?.find(
              (s) => s.id === row.staff_id,
            )?.name;
            row.service_name = services.data?.find(
              (s) => s.id === row.service_id,
            )?.name;
          }
        }
        return response(
          {
            items,
            has_more: (data ?? []).length >= 100,
            next_cursor: items.length
              ? { id: items.at(-1)!.id, created_at: items.at(-1)!.created_at }
              : null,
          },
          requestId,
        );
      }
    }
    const { data, error } = await db.rpc(name, args);
    if (error) throw error;
    return response(data, requestId);
  } catch (error) {
    return fail(error, requestId);
  }
}
