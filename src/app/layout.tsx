import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Barbería OS",
  description: "Agenda, clientes y operación de tu barbería.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <a href="#content" className="skip-link">
          Ir al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
