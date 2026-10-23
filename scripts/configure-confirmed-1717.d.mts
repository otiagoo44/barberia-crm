export interface Confirmed1717Options {
  projectRef: string;
  organizationId: string;
  branchId: string;
  estebanId: string;
  jonatanId: string;
  effectiveDate: string;
}
export function confirmed1717Sql(
  options: Confirmed1717Options,
): Promise<string>;
