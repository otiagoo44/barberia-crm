export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type DataRow = {
  id: string;
  organization_id?: string;
  branch_id?: string | null;
  created_at?: string;
  [key: string]: Json | undefined;
};
export type Role =
  | "platform_admin"
  | "organization_owner"
  | "manager"
  | "receptionist"
  | "barber";
export type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  brand_color: string;
  logo_url: string | null;
};
export type Branch = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  active: boolean;
};
export type Staff = {
  id: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
};
export type Service = {
  id: string;
  name: string;
  slug: string;
  default_duration_minutes: number;
  composition_mode: string;
  base_service_id: string | null;
  suggested_return_days: number | null;
  active: boolean;
};
export type Appointment = {
  id: string;
  branch_id: string;
  staff_id: string;
  customer_id: string;
  customer_name: string;
  staff_name: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  services: { id: string; name: string }[];
  price_minor: number | null;
  currency: string;
};
export type Page<T> = {
  items: T[];
  has_more: boolean;
  next_cursor?: { id: string; created_at: string } | null;
};
export type Workspace = {
  organization: Organization;
  branches: Branch[];
  role: Role;
  profileId: string;
  fullName: string;
  platformAdmin: boolean;
  staffId: string | null;
};
