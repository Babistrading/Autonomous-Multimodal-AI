import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "react-qr-code";
import { Download, Shield, CheckCircle2, AlertCircle, Smartphone, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const CERTS = [
  { id: "workone" as const, label: "Certificate 1", subtitle: "Jiangsu Simcere · Primary" },
  { id: "worktwo" as const, label: "Certificate 2", subtitle: "Jiangsu Simcere · Secondary" },
];
type CertId = (typeof CERTS)[number]["id"];

interface IosStatus {
  workone: { available: boolean };
  worktwo: { available: boolean };
}
interface ExpoUrlData {
  expoUrl: string;   // exp://…  — open in Expo Go
  webUrl: string;    // https://… — QR target on desktop
  domain: string;
}

function apiBase() { return `${window.location.origin}/api`; }
function manifestUrl(cert: CertId) { return `${apiBase()}/ios/manifest/${cert}.plist`; }
function installUrl(cert: CertId) {
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl(cert))}`;
}
function isIosSafari() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /WebKit/.test(ua) && !/CriOS|FxiOS/.test(ua);
}
function isIosDevice() { return /iPad|iPhone|iPod/.test(navigator.userAgent); }

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
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
      const r = await fetch(`${apiBase()}/ios/status`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: expoData } = useQuery<ExpoUrlData>({
    queryKey: ["expo-url"],
    queryFn: async () => {
      const r = await fetch(`${apiBase()}/expo-url`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: Infinity,
  });

  const isAvailable = status?.[selectedCert]?.available ?? false;
  const onIos = isIosDevice();
  const onIosSafari = isIosSafari();
  const expoUrl = expoData?.expoUrl;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* ── App header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-5 text-center">
          <img
            src="/logo.png"
            alt="Babis M1"
            className="w-24 h-24 rounded-[22px] shadow-xl shadow-primary/20 border border-primary/20"
          />
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-bold font-mono tracking-tight">Babis M1</h1>
            <p className="text-sm text-muted-foreground">AI Powered · Limitless Possibilities</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                v1.0.0
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20 border border-border px-2 py-0.5 rounded">
                iOS
              </span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            EXPO GO — INSTANT INSTALL (no Apple account needed)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-primary/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-mono font-bold text-foreground">Install via Expo Go</p>
              <p className="text-[11px] text-muted-foreground">Free · No Apple account needed · Instant</p>
            </div>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-primary bg-primary/15 border border-primary/30 px-2 py-1 rounded">
              RECOMMENDED
            </span>
          </div>

          <div className="px-6 py-5 flex flex-col gap-5">
            {!expoUrl ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : onIos ? (
              /* ── On iPhone/iPad: one-tap deep link ── */
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/10 border border-secondary/30">
                  <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tap <strong className="text-foreground">Open in Expo Go</strong> below.
                    iOS will launch Expo Go and load the Babis AI app instantly.
                    If you don't have Expo Go,{" "}
                    <a
                      href="https://apps.apple.com/app/expo-go/id982107779"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      download it free from the App Store
                    </a>{" "}
                    first.
                  </p>
                </div>
                <a
                  href={expoUrl}
                  className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-primary text-background font-mono font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  <Smartphone className="h-5 w-5" />
                  Open in Expo Go
                </a>
                <p className="text-center font-mono text-[10px] text-muted-foreground">
                  Requires <strong className="text-foreground">Expo Go</strong> from the App Store
                </p>
              </div>
            ) : (
              /* ── On desktop: QR code + copy link ── */
              <div className="flex flex-col gap-4">
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">On iPhone:</strong> open the Camera app,
                  point it at the QR code, then tap the banner that appears.
                  Expo Go will open and load Babis AI instantly.
                </p>
                <div className="flex flex-col items-center gap-3">
                  {/* QR code — white background required for scanners */}
                  <div className="p-4 bg-white rounded-2xl shadow-lg shadow-black/20 border border-border/20">
                    <QRCodeSVG
                      value={expoUrl}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#0a0d12"
                      level="M"
                      imageSettings={{
                        src: "/logo.png",
                        height: 36,
                        width: 36,
                        excavate: true,
                      }}
                    />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground text-center">
                    Scan with iPhone Camera app
                  </p>
                </div>

                {/* Copyable URL */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
                  <code className="flex-1 font-mono text-[10px] text-muted-foreground truncate">
                    {expoUrl}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(expoUrl)}
                    className="shrink-0 font-mono text-[10px] text-primary hover:text-primary/80 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Steps
              </span>
              {[
                onIos
                  ? 'Tap "Open in Expo Go" above.'
                  : "Open your iPhone Camera and scan the QR code above.",
                "Tap the banner — Expo Go opens automatically.",
                "The Babis AI app loads. No installation prompt required.",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
                    <span className="font-mono text-[10px] font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ENTERPRISE IPA — for signed distribution
        ══════════════════════════════════════════════════════════════════ */}
        <details className="group rounded-2xl border border-border bg-card overflow-hidden">
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer select-none list-none">
            <div className="flex items-center gap-3">
              <AppleLogo className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-mono font-semibold text-foreground">
                  Enterprise IPA Distribution
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Jiangsu Simcere certificates · requires signed build
                </p>
              </div>
            </div>
            <svg
              className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="border-t border-border px-6 py-5 flex flex-col gap-5">
            {/* Cert selector */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Certificate
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
                          : "border-border bg-muted/10 hover:border-primary/30",
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-xs font-semibold text-foreground">{cert.label}</span>
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          isLoading ? "bg-muted-foreground/30 animate-pulse"
                            : (status?.[cert.id]?.available ?? false) ? "bg-secondary"
                            : "bg-muted-foreground/30",
                        )} />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">{cert.subtitle}</span>
                      <span className={cn(
                        "font-mono text-[9px] uppercase tracking-wider",
                        (status?.[cert.id]?.available ?? false) ? "text-secondary" : "text-muted-foreground/50",
                      )}>
                        {(status?.[cert.id]?.available ?? false) ? "● Ready" : "○ Pending upload"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status + install button */}
            {isAvailable ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/10 border border-secondary/30">
                <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">
                  {onIosSafari
                    ? "Tap Install — iOS will prompt for confirmation."
                    : "Open this page in Safari on your iPhone, then tap Install."}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">
                  Place <code className="text-primary/80">{selectedCert}.ipa</code> in{" "}
                  <code className="text-primary/80">artifacts/api-server/ios/builds/</code> to activate.
                </p>
              </div>
            )}

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
              <AppleLogo className="h-5 w-5" />
              {onIosSafari ? "Install on this device" : "Install on iOS"}
            </a>

            {!onIosSafari && (
              <p className="text-center font-mono text-[10px] text-muted-foreground">
                Must be opened in <strong className="text-foreground">Safari</strong> on iPhone or iPad
              </p>
            )}

            {/* Steps */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                How to Install
              </span>
              {[
                "Open this page in Safari on your iPhone or iPad.",
                'Select a certificate and tap "Install on this device".',
                "Tap Install when iOS asks for confirmation.",
                "Go to Settings → General → VPN & Device Management and trust the Jiangsu Simcere certificate.",
                "Open Babis M1 from your home screen.",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
                    <span className="font-mono text-[10px] font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </details>

        {/* Enterprise notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/10 border border-border">
          <Shield className="h-4 w-4 text-primary/50 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] font-semibold text-foreground">Enterprise Distribution</span>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              This app is intended for authorized users of Jiangsu Simcere Pharmaceutical Co., Ltd.
              The Expo Go method is available for internal testing.
            </p>
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
