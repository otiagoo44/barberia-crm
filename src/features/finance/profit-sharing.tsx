"use client";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/features/organizations/context";
import { Field, Notice } from "@/components/ui";
import { financeCommand, money, type FinanceCatalog } from "./client";

export type ProfitSharingSummary = {
  profit_minor: number | string | null;
  per_partner_minor: number | string | null;
  remainder_minor: number | string | null;
  partners: { id: string; name: string }[];
};

export function ProfitSharing({ summary }: { summary: ProfitSharingSummary }) {
  const { organization } = useWorkspace();
  return (
    <section className="panel stack" aria-label="Reparto de ganancias">
      <div>
        <h2>Ganancia a repartir</h2>
        <p>
          Ventas cobradas menos tarifas POS, gastos operativos y comisiones
          registradas de otros barberos.
        </p>
      </div>
      <strong>{money(summary.profit_minor, organization.currency)}</strong>
      {summary.profit_minor === null ? (
        <Notice>
          Faltan tarifas o comisiones históricas por confirmar para calcular el
          reparto.
        </Notice>
      ) : (
        <>
          <div className="kpi-grid">
            {summary.partners.map((partner) => (
              <div className="kpi" key={partner.id}>
                <span>
                  {partner.name} · {100 / summary.partners.length}%
                </span>
                <strong>
                  {money(summary.per_partner_minor, organization.currency)}
                </strong>
              </div>
            ))}
          </div>
          {Number(summary.profit_minor) < 0 && (
            <Notice>
              El período tiene pérdida. No hay ganancia para repartir.
            </Notice>
          )}
          {Number(summary.remainder_minor) > 0 && (
            <p>
              Resto en el negocio por redondeo:{" "}
              {money(summary.remainder_minor, organization.currency)}.
            </p>
          )}
        </>
      )}
      <p className="muted">
        Estimación del período con los gastos cargados. Revisá que estén
        incluidos alquiler, servicios y demás gastos fijos. No registra pagos ni
        descuenta adelantos o retiros personales.
      </p>
    </section>
  );
}

export function RemunerationSettings({
  catalog,
  onSaved,
}: {
  catalog: FinanceCatalog;
  onSaved: () => void;
}) {
  const w = useWorkspace();
  const [model, setModel] = useState(
    String(catalog.settings?.remuneration_model ?? "commission"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const selected = (catalog.settings?.profit_share_staff_ids ?? []) as string[];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await financeCommand(
        w.organization.id,
        w.branchId,
        "configure_settings",
        {
          remuneration_model: model,
          profit_share_staff_ids:
            model === "equal_profit_share" ? form.getAll("partners") : [],
        },
        requestKey,
      );
      setRequestKey(crypto.randomUUID());
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el reparto.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel stack" onSubmit={save}>
      <h2>Cómo gana el equipo</h2>
      <Field label="Modalidad">
        <select
          value={model}
          onChange={(event) => {
            setModel(event.target.value);
            setRequestKey(crypto.randomUUID());
          }}
        >
          <option value="commission">Comisión por servicio</option>
          <option value="equal_profit_share">
            Ganancia en partes iguales después de gastos
          </option>
        </select>
      </Field>
      {model === "equal_profit_share" && (
        <fieldset>
          <legend>Socios que participan (mínimo dos)</legend>
          {catalog.staff.map((staff) => (
            <label className="row" key={staff.id}>
              <input
                type="checkbox"
                name="partners"
                value={staff.id}
                defaultChecked={selected.includes(staff.id)}
                onChange={() => setRequestKey(crypto.randomUUID())}
              />
              {String(staff.name)}
            </label>
          ))}
        </fieldset>
      )}
      <p className="muted">
        Definí esta modalidad antes de registrar ventas. Después queda protegida
        para conservar el significado del historial. Los socios no generan una
        comisión por cada servicio.
      </p>
      {error && <Notice error>{error}</Notice>}
      <button className="primary" disabled={busy}>
        {busy ? "Guardando…" : "Guardar modalidad"}
      </button>
    </form>
  );
}
