"use client";
import { useWorkspace } from "@/features/organizations/context";
import { useResource, resourceUrl } from "@/lib/client";
import {
  RecordManager,
  currencyScale,
} from "@/features/configuration/record-manager";
import type { DataRow, Page } from "@/lib/types";
export function Goals() {
  const w = useWorkspace();
  const r = useResource<Page<DataRow>>(
    resourceUrl("goals", { org: w.organization.id }),
  );
  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">OBJETIVOS DEL NEGOCIO</span>
          <h1>Metas</h1>
          <p>
            Una dirección clara para la organización, el local o cada barbero.
          </p>
        </div>
      </div>
      <div className="record-grid">
        {r.data?.items
          .filter((g) => g.active)
          .map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
      </div>
      <RecordManager entity="goals" readOnly={w.role === "barber"} />
    </section>
  );
}
export function GoalCard({ goal }: { goal: DataRow }) {
  const w = useWorkspace();
  const display = (value: unknown) =>
    value === null || value === undefined
      ? "—"
      : goal.metric === "production_value"
        ? new Intl.NumberFormat("es", {
            style: "currency",
            currency: w.organization.currency,
          }).format(Number(value) / currencyScale(w.organization.currency))
        : String(value);
  const r = useResource<{
    value: number | null;
    progress_percent: number | null;
  }>(resourceUrl("goal_progress", { org: w.organization.id, id: goal.id }));
  return (
    <article className="panel goal-card">
      <h3>{String(goal.name)}</h3>
      <p className="muted">
        {String(goal.period)} ·{" "}
        {new Date(String(goal.starts_at)).toLocaleDateString("es")}–
        {new Date(
          new Date(String(goal.ends_at)).getTime() - 1,
        ).toLocaleDateString("es")}
      </p>
      <progress
        aria-label={`Progreso de ${String(goal.name)}`}
        value={Math.min(r.data?.progress_percent ?? 0, 100)}
        max={100}
      />
      <div className="row between">
        <strong>
          {display(r.data?.value)} / {display(goal.target_value)}
        </strong>
        <span>
          {r.data?.progress_percent !== null &&
          r.data?.progress_percent !== undefined
            ? `${r.data.progress_percent}%`
            : "Sin datos suficientes"}
        </span>
      </div>
      {r.error && <small>{r.error}</small>}
    </article>
  );
}
