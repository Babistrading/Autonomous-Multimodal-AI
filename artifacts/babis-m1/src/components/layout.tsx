import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, Cpu, Server, Database, Bot, Brain } from "lucide-react";
import { useGetTrainingStatus } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/",          label: "Chat",     icon: MessageSquare },
  { path: "/training",  label: "Training", icon: Cpu },
  { path: "/workers",   label: "Workers",  icon: Server },
  { path: "/datasets",  label: "Datasets", icon: Database },
  { path: "/agents",    label: "Agents",   icon: Bot },
  { path: "/model",     label: "Model",    icon: Brain },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [expanded, setExpanded] = useState(false);

  // Poll training status for the live pulse indicator in the nav
  const { data: trainingStatus } = useGetTrainingStatus(undefined, {
    query: { refetchInterval: 3_000 },
  });
  const isTraining = trainingStatus?.status === "running";

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground dark">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-sidebar transition-all duration-300 z-50 shrink-0",
          expanded ? "w-[200px]" : "w-[64px]",
        )}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-border px-3 gap-3 overflow-hidden">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Cpu className="h-4 w-4" />
            {/* Live training dot */}
            {isTraining && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
              </span>
            )}
          </div>
          {expanded && (
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="font-mono font-bold tracking-tight text-primary text-sm truncate leading-tight">
                BABIS M1
              </span>
              <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider truncate">
                {isTraining ? "Training" : "Idle"}
              </span>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 p-2 pt-4">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center rounded-lg p-2.5 transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
                title={!expanded ? item.label : undefined}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                {expanded && (
                  <span className="ml-3 font-mono text-xs uppercase tracking-wider truncate">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer — training status */}
        {expanded && (
          <div className="p-3 border-t border-border">
            <div className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded font-mono text-[9px] uppercase tracking-wider",
              isTraining ? "text-secondary" : "text-muted-foreground",
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full", isTraining ? "bg-secondary animate-pulse" : "bg-muted-foreground")} />
              {isTraining
                ? `Step ${trainingStatus?.step?.toLocaleString() ?? "—"}`
                : "Stopped"
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] pb-[64px] md:pb-0 relative overflow-hidden bg-background">
        {children}
      </main>

      {/* ── Mobile tab bar ────────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] border-t border-border bg-sidebar flex items-stretch justify-around z-50 px-safe">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          const isTrainingTab = item.path === "/training";

          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <div className="relative">
                <Icon className="h-[18px] w-[18px]" />
                {/* Live training pulse on Training tab */}
                {isTrainingTab && isTraining && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-secondary" />
                  </span>
                )}
              </div>
              <span className={cn(
                "font-mono uppercase leading-none tracking-tight",
                isActive ? "text-[9px]" : "text-[9px] opacity-70",
              )}>
                {item.label}
              </span>
              {/* Active underline */}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
