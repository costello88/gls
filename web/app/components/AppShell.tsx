import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-yellow-400">
            GLS Sync
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-slate-200 hover:text-white">
              Bestellingen
            </Link>
            <Link href="/automatisering" className="text-sm font-medium text-slate-200 hover:text-white">
              Automatisering
            </Link>
            <Link href="/instellingen" className="text-sm font-medium text-slate-200 hover:text-white">
              Instellingen
            </Link>
            <Link href="/opruimen" className="text-sm font-medium text-slate-200 hover:text-white">
              Opruimen
            </Link>
            <Link href="/hulp" className="text-sm font-medium text-yellow-400 hover:text-yellow-300">
              Hulp
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
