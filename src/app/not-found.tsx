import Link from "next/link";
export default function NotFound() {
  return (
    <main id="content" className="org-page">
      <h1>No encontramos esta página</h1>
      <Link href="/">Volver al inicio</Link>
    </main>
  );
}
