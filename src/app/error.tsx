"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="content" className="org-page">
      <h1>No pudimos abrir esta pantalla</h1>
      <p>Podés volver a intentarlo. Si continúa, contactá al administrador.</p>
      <button className="primary" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
