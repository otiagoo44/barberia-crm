export function pos1717Sql(options: {
  projectRef: string;
  organizationId: string;
  effectiveFrom: string;
  evidenceReference: string;
  percentageBps: { debit: number; credit: number };
  rateComponents: Record<
    "debit" | "credit",
    { processing: number; vat: number; withholding: number; other: number }
  >;
  fixedAmountMinor: { debit: number; credit: number };
  vatTreatment: string;
  withholdingTreatment: string;
  otherChargesTreatment: string;
}): string;
