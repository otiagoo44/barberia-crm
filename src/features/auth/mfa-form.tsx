"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { api } from "@/lib/client";
import { Field, Notice } from "@/components/ui";
import { SignOut } from "./auth-form";
type Factor = { id: string; name: string; status: string };
export function MfaForm({
  level,
  factors,
  failed,
  next = "/",
}: {
  level: string;
  factors: Factor[];
  failed: boolean;
  next?: string;
}) {
  const verified = factors.filter((f) => f.status === "verified");
  const [enrollment, setEnrollment] = useState<{
    id: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [factor, setFactor] = useState(verified[0]?.id ?? "");
  const [error, setError] = useState(
    failed
      ? "No pudimos consultar tus dispositivos. Volvé a cargar esta página."
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(level === "aal2");
  async function enroll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const name = new FormData(e.currentTarget).get("name");
    try {
      setEnrollment(await api("/api/auth/mfa/enroll", { name }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const code = new FormData(e.currentTarget).get("code");
    try {
      await api("/api/auth/mfa/verify", {
        factor: enrollment?.id ?? factor,
        code,
      });
      setEnrollment(null);
      window.location.assign(manage ? "/mfa" : next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-card stack">
      <ShieldCheck size={30} aria-hidden="true" />
      <div>
        <span className="eyebrow">SEGURIDAD DE LA CUENTA</span>
        <h1>
          {level === "aal2"
            ? "Tu acceso está protegido"
            : "Verificá tu identidad"}
        </h1>
      </div>
      <p className="muted">
        Usá el código de tu aplicación de autenticación. Los accesos de
        administración y finanzas requieren esta verificación.
      </p>
      {error && <Notice error>{error}</Notice>}
      {level === "aal2" && !enrollment && (
        <Link className="primary" href={next}>
          {next === "/reset-password"
            ? "Continuar a nueva contraseña"
            : "Continuar a mis barberías"}
        </Link>
      )}
      {verified.length > 0 && !enrollment && level !== "aal2" && (
        <form className="stack" onSubmit={verify}>
          <Field label="Dispositivo">
            <select value={factor} onChange={(e) => setFactor(e.target.value)}>
              {verified.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <CodeField />
          <button className="primary" disabled={busy}>
            Verificar y continuar
          </button>
        </form>
      )}
      {!enrollment && (verified.length === 0 || manage) && (
        <form className="stack" onSubmit={enroll}>
          <h2>
            {verified.length
              ? "Agregar un autenticador de respaldo"
              : "Configurar autenticador"}
          </h2>
          <Field label="Nombre del dispositivo">
            <input
              name="name"
              required
              maxLength={60}
              placeholder="Mi teléfono"
            />
          </Field>
          <button disabled={busy || failed}>
            <KeyRound size={16} aria-hidden="true" /> Configurar dispositivo
          </button>
        </form>
      )}
      {enrollment && (
        <form className="stack" onSubmit={verify}>
          <h2>Escaneá y confirmá el código</h2>
          <img
            className="mfa-qr"
            src={enrollment.qr}
            width={220}
            height={220}
            alt="Código QR para agregar tu autenticador"
          />
          <details>
            <summary>Ingresar la clave manualmente</summary>
            <code className="secret-key">{enrollment.secret}</code>
          </details>
          <p className="muted">
            Guardá esta clave en un lugar privado. No la compartas por chat.
          </p>
          <CodeField />
          <button className="primary" disabled={busy}>
            Confirmar autenticador
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/auth/mfa/unenroll", { factor: enrollment.id });
                setEnrollment(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancelar configuración
          </button>
        </form>
      )}
      {level === "aal2" &&
        !enrollment &&
        verified.map((f) => (
          <div key={f.id} className="row between wrap">
            <span>{f.name}</span>
            <button
              disabled={busy || verified.length < 2}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api("/api/auth/mfa/unenroll", { factor: f.id });
                  window.location.reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Retirar dispositivo
            </button>
          </div>
        ))}
      <details className="recovery-help">
        <summary>Perdí acceso a mi autenticador</summary>
        <p>
          Elegí tu dispositivo de respaldo en el selector. Si no tenés uno,
          contactá al responsable de la plataforma para verificar tu identidad y
          recuperar el factor. Restablecer la contraseña por correo conserva el
          segundo factor.
        </p>
        <p>
          Después de verificar, agregá un autenticador de respaldo guardado por
          separado.
        </p>
      </details>
      {level === "aal2" && (
        <button
          onClick={async () => {
            try {
              await api("/api/auth/revoke_sessions", {});
              window.location.assign("/login");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Cerrar todas mis sesiones
        </button>
      )}
      {level !== "aal2" && verified.length > 0 && (
        <button onClick={() => setManage((v) => !v)}>
          Verificar para administrar dispositivos
        </button>
      )}
      <SignOut disabled={busy} />
    </section>
  );
}
function CodeField() {
  return (
    <Field label="Código de 6 dígitos">
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        minLength={6}
        maxLength={6}
        required
      />
    </Field>
  );
}
