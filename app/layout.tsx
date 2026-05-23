import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UE5 Blueprint → Text",
  description:
    "Convert UE5 Blueprint and Material clipboard text (T3D) into LLM-friendly Markdown, YAML, or JSON.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
