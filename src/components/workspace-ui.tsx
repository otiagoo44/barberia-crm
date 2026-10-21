"use client";
import { useId, type ReactNode } from "react";
import { Modal, Notice } from "./ui";

export function RecordDrawer(props: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return <Modal {...props} side />;
}
export function FilterBar({
  children,
  label = "Filtros",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="toolbar filter-bar" role="group" aria-label={label}>
      {children}
    </div>
  );
}
export function DataTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="table-wrap" role="region" aria-label={label} tabIndex={0}>
      <table>{children}</table>
    </div>
  );
}
export function ViewSwitcher({
  value,
  options,
  onChange,
  label = "Vista",
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="view-switcher" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
export function Tabs({
  value,
  options,
  onChange,
  children,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <div
        role="tablist"
        className="config-tabs"
        aria-label="Secciones de la ficha"
        onKeyDown={(e) => {
          const index = options.findIndex(([key]) => key === value);
          const next =
            e.key === "ArrowRight"
              ? (index + 1) % options.length
              : e.key === "ArrowLeft"
                ? (index + options.length - 1) % options.length
                : e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : null;
          if (next === null) return;
          e.preventDefault();
          onChange(options[next][0]);
          const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
          buttons[next]?.focus();
        }}
      >
        {options.map(([key, text]) => (
          <button
            role="tab"
            id={`${id}-${key}`}
            key={key}
            aria-selected={value === key}
            tabIndex={value === key ? 0 : -1}
            aria-controls={`${id}-panel`}
            onClick={() => onChange(key)}
          >
            {text}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${value}`}
      >
        {children}
      </div>
    </>
  );
}
export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <article className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
export function ActivityTimeline({ children }: { children: ReactNode }) {
  return (
    <div className="activity-timeline" aria-label="Actividad del cliente">
      {children}
    </div>
  );
}
export function ErrorState({
  children,
  retry,
}: {
  children: ReactNode;
  retry?: () => void;
}) {
  return (
    <Notice error>
      {children}
      {retry && <button onClick={retry}>Reintentar</button>}
    </Notice>
  );
}
export function ConfirmDialog({
  title,
  children,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="stack">
        {children}
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <button disabled={pending} onClick={onClose}>
            Cancelar
          </button>
          <button className="danger" disabled={pending} onClick={onConfirm}>
            {pending ? "Procesando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
