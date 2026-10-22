"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { api } from "@/lib/client";
import { Field, Notice } from "@/components/ui";
import { ConfirmDialog } from "@/components/workspace-ui";
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
  const [confirmation, setConfirmation] = useState<
    { kind: "factor"; factor: Factor } | { kind: "sessions" } | null
  >(null);
  async function confirmSecurityAction() {
    if (!confirmation || busy) return;
    setBusy(true);
    setError("");
    try {
      if (confirmation.kind === "factor") {
        await api("/api/auth/mfa/unenroll", { factor: confirmation.factor.id });
        window.location.reload();
      } else {
        await api("/api/auth/revoke_sessions", {});
        window.location.assign("/login");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
        {level === "aal2"
          ? "Tu sesión ya está verificada. Podés continuar o agregar un autenticador de respaldo."
          : verified.length
            ? "Abrí la app autenticadora de tu teléfono e ingresá su código de 6 dígitos. Este código no llega por correo ni WhatsApp."
            : "Para proteger tu cuenta, primero vinculá una app autenticadora de tu teléfono. La usarás para generar el código de acceso."}
      </p>
      {error && !confirmation && <Notice error>{error}</Notice>}
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
          <button aria-busy={!!busy} className="primary" disabled={busy}>
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
          {verified.length === 0 && (
            <details>
              <summary>No tengo una app autenticadora</summary>
              <p className="muted">
                Instalá Google Authenticator gratis en tu teléfono:{" "}
                <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2">
                  Android
                </a>{" "}
                o{" "}
                <a href="https://apps.apple.com/app/google-authenticator/id388497605">
                  iPhone
                </a>
                . También podés usar Microsoft Authenticator. Después, elegí un
                nombre abajo y configurá el dispositivo para ver el QR.
              </p>
            </details>
          )}
          <Field label="Nombre del dispositivo">
            <input
              name="name"
              required
              maxLength={60}
              placeholder="Mi teléfono"
            />
          </Field>
          <button aria-busy={!!busy} disabled={busy || failed}>
            <KeyRound size={16} aria-hidden="true" /> Configurar dispositivo
          </button>
        </form>
      )}
      {enrollment && (
        <form className="stack" onSubmit={verify}>
          <h2>Escaneá y confirmá el código</h2>
          <p className="muted">
            Abrí la app autenticadora en tu teléfono, tocá Agregar o + y elegí
            Escanear código QR. Escaneá desde esa app, no desde la cámara
            normal. Después, ingresá aquí los 6 dígitos que muestra la app.
          </p>
          <img
            className="mfa-qr"
            src={enrollment.qr}
            width={220}
            height={220}
            alt="Código QR para agregar tu autenticador"
          />
          <details>
            <summary>Ingresar la clave manualmente</summary>
            <p className="muted">
              Si usás la CRM en el mismo teléfono, elegí Ingresar clave de
              configuración en tu app autenticadora y pegá esta clave. Usá la
              opción basada en tiempo.
            </p>
            <code className="secret-key">{enrollment.secret}</code>
          </details>
          <p className="muted">
            Guardá esta clave en un lugar privado. No la compartas por chat.
          </p>
          <CodeField />
          <button aria-busy={!!busy} className="primary" disabled={busy}>
            Confirmar autenticador
          </button>
          <button
            aria-busy={!!busy}
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
              aria-busy={!!busy}
              disabled={busy || verified.length < 2}
              onClick={() => {
                setError("");
                setConfirmation({ kind: "factor", factor: f });
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
          aria-busy={!!busy}
          disabled={busy}
          onClick={() => {
            setError("");
            setConfirmation({ kind: "sessions" });
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
      {confirmation && (
        <ConfirmDialog
          title={
            confirmation.kind === "factor"
              ? "Retirar dispositivo"
              : "Cerrar todas mis sesiones"
          }
          pending={busy}
          error={error}
          onClose={() => {
            if (!busy) {
              setConfirmation(null);
              setError("");
            }
          }}
          onConfirm={() => {
            void confirmSecurityAction();
          }}
        >
          <p>
            {confirmation.kind === "factor"
              ? `Vas a retirar ${confirmation.factor.name}. Asegurate de poder entrar con otro autenticador verificado. Esta clave dejará de servir para iniciar sesión.`
              : "Se cerrará tu acceso en todos los dispositivos, incluido este. Vas a necesitar tu contraseña y autenticador para volver a entrar."}
          </p>
        </ConfirmDialog>
      )}
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
