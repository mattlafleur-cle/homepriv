import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "../AdminForms";
import { adminEnabled, isAdmin } from "@/lib/admin-auth";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Operator sign in", robots: { index: false, follow: false } };

export default async function AdminLogin() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main id="main" className="container-page py-16">
      <div className="mx-auto max-w-sm rounded-[var(--radius-card)] border border-line bg-paper p-8">
        <Logo />
        <h1 className="mt-6 text-[1.6rem] font-medium">Operator sign in</h1>
        {adminEnabled() ? (
          <div className="mt-6"><LoginForm /></div>
        ) : (
          <p className="mt-4 text-muted">
            Admin access is turned off. Set ADMIN_PASSWORD and SESSION_SECRET in the environment, then restart. You can also review
            requests from the command line with <code className="font-mono">npm run ops -- list</code>.
          </p>
        )}
      </div>
    </main>
  );
}
