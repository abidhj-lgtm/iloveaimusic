import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Console",
  description: "Staff console for I Love AI Music.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm-root">{children}</div>;
}