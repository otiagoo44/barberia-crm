"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { Field, Notice } from "@/components/ui";
export function AuthForm({
  reset = false,
  temporary = false,
}: {
  reset?: boolean;
  temporary?: boolean;
}) {
  const [mode, setMode] = useState<
    "signin" | "signup" | "recover" | "confirm" | "password"
  >(reset ? "password" : "signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      const payload: Record<string, unknown> = {};
      if (mode !== "password") payload.email = form.get("email");
      if (mode !== "recover" && mode !== "confirm")
        payload.password = form.get("password");
      if (mode === "signup") payload.name = form.get("name");
      const result = await api<{ message?: string }>(
        `/api/auth/${mode}`,
        payload,
      );
      if (mode === "signin" || mode === "password") window.location.assign("/");
      else setMessage(result.message ?? "Revisá tu correo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-card">
      <span className="eyebrow">BARBERÍA OS</span>
      <h1>
        {mode === "signin"
          ? "Tu negocio, en orden."
          : mode === "signup"
            ? "Creá tu cuenta"
            : mode === "confirm"
              ? "Confirmar tu correo"
              : mode === "recover"
                ? "Recuperar acceso"
                : "Nueva contraseña"}
      </h1>
      <p className="muted">
        {mode === "signin"
          ? "Entrá para organizar el día, atender a tus clientes y ver cómo va tu barbería."
          : mode === "signup"
            ? "Después de confirmar tu correo, el propietario podrá asignarte acceso."
            : mode === "confirm"
              ? "Pedí un nuevo mensaje y confirmá tu propia dirección de correo."
              : mode === "recover"
                ? "Ingresá tu correo y te enviaremos un enlace para recuperar el acceso."
                : temporary
                  ? "Tu cuenta usa una contraseña temporal. Verificá tu autenticador y elegí una contraseña propia de al menos 12 caracteres para poder ingresar."
                  : "Usá una contraseña de al menos 12 caracteres."}
      </p>
      <form onSubmit={submit} className="stack">
        {mode === "signup" && (
          <Field label="Tu nombre">
            <input name="name" autoComplete="name" required maxLength={120} />
          </Field>
        )}
        {mode !== "password" && (
          <Field label="Correo electrónico">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </Field>
        )}
        {mode !== "recover" && mode !== "confirm" && (
          <Field label="Contraseña">
            <input
              type="password"
              name="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={mode === "signin" ? 1 : 12}
              maxLength={128}
            />
          </Field>
        )}
        {error && <Notice error>{error}</Notice>}
        {message && <Notice success>{message}</Notice>}
        <button aria-busy={!!busy} className="primary" disabled={busy}>
          {busy
            ? "Un momento…"
            : mode === "signin"
              ? "Entrar"
              : mode === "signup"
                ? "Crear cuenta"
                : mode === "recover" || mode === "confirm"
                  ? "Enviar instrucciones"
                  : "Guardar contraseña"}
        </button>
      </form>
      {!reset && (
        <div className="auth-options">
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setMessage("");
            }}
          >
            {mode === "signin" ? "Crear una cuenta" : "Volver a entrar"}
          </button>
          {mode === "signin" && (
            <button onClick={() => setMode("confirm")}>
              Reenviar confirmación
            </button>
          )}
          {mode === "signin" && (
            <button onClick={() => setMode("recover")}>
              Olvidé mi contraseña
            </button>
          )}
        </div>
      )}
    </section>
  );
}
export function SignOut({ disabled = false }: { disabled?: boolean } = {}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        aria-busy={!!busy}
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await api("/api/auth/signout", {});
            window.location.assign("/login");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Salir
      </button>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
