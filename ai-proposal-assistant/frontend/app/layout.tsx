import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Proposal Assistant",
  description: "Asistente inteligente para responder propuestas de Workana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-surface-black text-text-primary min-h-screen">
        {children}
      </body>
    </html>
  );
}
