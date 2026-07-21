import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Shield, CheckCircle2, AlertCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const CERTS = [
  {
    id: "workone" as const,
    label: "Certificate 1",
    subtitle: "Jiangsu Simcere · Primary",
  },
  {
    id: "worktwo" as const,
    label: "Certificate 2",
    subtitle: "Jiangsu Simcere · Secondary",
  },
];

type CertId = (typeof CERTS)[number]["id"];

interface IosStatus {
  workone: { available: boolean };
  worktwo: { available: boolean };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiBase(): string {
  return `${window.location.origin}/api`;
}

function manifestUrl(cert: CertId): string {
  return `${apiBase()}/ios/manifest/${cert}.plist`;
}

function installUrl(cert: CertId): string {
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl(cert))}`;
}

/** Detect iOS Safari — the only browser that can trigger OTA installs. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isCriOS = /CriOS/.test(ua); // Chrome on iOS
  const isFxiOS = /FxiOS/.test(ua); // Firefox on iOS
  return isIos && isWebkit && !isCriOS && !isFxiOS;
}

// ---------------------------------------------------------------------------
// Apple logo SVG (inline — lucide-react doesn't ship one)
// ---------------------------------------------------------------------------

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DownloadPage() {
  const [selectedCert, setSelectedCert] = useState<CertId>("workone");

  const { data: status, isLoading } = useQuery<IosStatus>({
    queryKey: ["ios-status"],
    queryFn: async () => {
      const res = await fetch(`${apiBase()}/ios/status`);
      if (!res.ok) throw new Error("Failed to fetch iOS status");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const isAvailable = status?.[selectedCert]?.available ?? false;
  const onIosSafari = isIosSafari();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* ── App header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            <img
              src="/logo.png"
              alt="Babis M1 logo"
              className="w-24 h-24 rounded-[22px] shadow-xl shadow-primary/20 border border-primary/20"
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">
              Babis M1
            </h1>
            <p className="text-sm text-muted-foreground">
              AI Powered · Limitless Possibilities
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                v1.0.0
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20 border border-border px-2 py-0.5 rounded">
                iOS Enterprise
              </span>
            </div>
          </div>
        </div>

        {/* ── Certificate selector ───────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-0.5">
            Distribution Certificate
          </span>
          <div className="grid grid-cols-2 gap-2">
            {CERTS.map((cert) => {
              const available = status?.[cert.id]?.available ?? false;
              const active = selectedCert === cert.id;
              return (
                <button
                  key={cert.id}
                  onClick={() => setSelectedCert(cert.id)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 p-4 rounded-xl border transition-all text-left",
                    active
                      ? "border-primary/60 bg-primary/10 shadow-sm shadow-primary/20"
                      : "border-border bg-card hover:border-primary/30 hover:bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {cert.label}
                    </span>
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        isLoading
                          ? "bg-muted-foreground/30 animate-pulse"
                          : available
                          ? "bg-secondary"
                          : "bg-muted-foreground/30",
                      )}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {cert.subtitle}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[9px] uppercase tracking-wider",
                      available ? "text-secondary" : "text-muted-foreground/50",
                    )}
                  >
                    {available ? "● Ready" : "○ Pending upload"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Install card ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-6 flex flex-col gap-5">

            {/* Status banner */}
            {isAvailable ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/10 border border-secondary/30">
                <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-mono font-semibold text-secondary">
                    Ready to install
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {onIosSafari
                      ? "Tap Install below — you will be prompted by iOS."
                      : "Open this page in Safari on your iPhone or iPad, then tap Install."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-mono font-semibold text-muted-foreground">
                    Build not yet available
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    The signed IPA for this certificate hasn't been uploaded yet.
                    Place <code className="text-primary/80">{selectedCert}.ipa</code> in{" "}
                    <code className="text-primary/80">artifacts/api-server/ios/builds/</code>.
                  </p>
                </div>
              </div>
            )}

            {/* Install button */}
            {onIosSafari ? (
              <a
                href={isAvailable ? installUrl(selectedCert) : undefined}
                aria-disabled={!isAvailable}
                className={cn(
                  "flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-mono font-bold text-sm transition-all select-none",
                  isAvailable
                    ? "bg-primary text-background hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/30 cursor-pointer"
                    : "bg-muted/30 text-muted-foreground border border-border cursor-not-allowed pointer-events-none",
                )}
              >
                <AppleLogo className="h-5 w-5" />
                Install on this device
              </a>
            ) : (
              <div className="flex flex-col gap-3">
                <a
                  href={isAvailable ? installUrl(selectedCert) : undefined}
                  aria-disabled={!isAvailable}
                  className={cn(
                    "flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-mono font-bold text-sm transition-all select-none",
                    isAvailable
                      ? "bg-primary text-background hover:bg-primary/90 shadow-lg shadow-primary/30 cursor-pointer"
                      : "bg-muted/30 text-muted-foreground border border-border cursor-not-allowed pointer-events-none",
                  )}
                >
                  <Download className="h-5 w-5" />
                  Install on iOS
                </a>
                <p className="text-center font-mono text-[10px] text-muted-foreground">
                  Must be opened in <strong className="text-foreground">Safari</strong> on iPhone or iPad
                </p>
              </div>
            )}
          </div>

          {/* Requirements */}
          <div className="border-t border-border px-6 py-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-3">
              Requirements
            </span>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                { label: "Platform", value: "iOS 16.0 or later" },
                { label: "Device", value: "iPhone / iPad" },
                { label: "Browser", value: "Safari (required)" },
                { label: "Distribution", value: "Apple Enterprise" },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Installation steps ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            How to Install
          </span>
          <div className="flex flex-col gap-2">
            {[
              {
                n: "1",
                text: "Open this page in Safari on your iPhone or iPad.",
              },
              {
                n: "2",
                text: 'Select a certificate above and tap "Install on this device".',
              },
              {
                n: "3",
                text: 'Tap "Install" when iOS asks for confirmation.',
              },
              {
                n: "4",
                text: "Go to Settings → General → VPN & Device Management, find the Jiangsu Simcere Pharmaceutical certificate, and tap Trust.",
              },
              {
                n: "5",
                text: "Return to your home screen and open Babis M1.",
              },
            ].map(({ n, text }) => (
              <div
                key={n}
                className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
                  <span className="font-mono text-[10px] font-bold text-primary">{n}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Enterprise notice ──────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/10 border border-border">
          <Shield className="h-4 w-4 text-primary/50 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] font-semibold text-foreground">
              Enterprise Distribution
            </span>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              This app is distributed through Apple's Enterprise Developer Program and is intended
              exclusively for authorized users of Jiangsu Simcere Pharmaceutical Co., Ltd.
            </p>
          </div>
        </div>

        {/* ── Mobile spacer ─────────────────────────────────────────────── */}
        <div className="h-4" />
      </div>
    </div>
  );
}
