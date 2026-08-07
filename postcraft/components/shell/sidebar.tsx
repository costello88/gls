"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Sparkles,
  CalendarDays,
  Megaphone,
  Gift,
  UserPlus,
  Images,
  BarChart3,
  AtSign,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/giveaways", label: "Giveaways", icon: Gift },
  { href: "/outreach", label: "Outreach", icon: UserPlus },
  { href: "/library", label: "Library", icon: Images },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/accounts", label: "Accounts", icon: AtSign },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-line flex flex-col h-screen sticky top-0">
      <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-line">
        <span className="w-2.5 h-2.5 rounded-full bg-accent" />
        <span className="display text-lg text-paper tracking-tight">Postcraft</span>
      </Link>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-ink-3 text-paper border border-line"
                  : "text-paper-dim hover:text-paper hover:bg-ink-2",
              )}
            >
              <Icon size={16} className={cn(active && "text-accent")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-line">
        <div className="microlabel">Content machine</div>
        <div className="text-xs text-muted mt-1">design → copy → publish</div>
      </div>
    </aside>
  );
}
