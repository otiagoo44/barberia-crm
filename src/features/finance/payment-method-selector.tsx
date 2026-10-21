"use client";
import { Field } from "@/components/ui";
import type { FinanceRow } from "./client";
/** Options always come from the authorized branch's real finance catalog. */
export function PaymentMethodSelector({
  methods,
  value,
  onChange,
  disabled = false,
}: {
  methods: FinanceRow[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label="Medio de pago">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {methods.map((m) => (
          <option key={m.id} value={m.id}>
            {String(m.name)}
          </option>
        ))}
      </select>
    </Field>
  );
}
