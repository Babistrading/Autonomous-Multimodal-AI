import { Router } from "express";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IOS_DIR = join(__dirname, "../../ios");

const router = Router();

const VALID_CERTS = ["workone", "worktwo"] as const;
type CertId = (typeof VALID_CERTS)[number];

function isValidCert(cert: string): cert is CertId {
  return (VALID_CERTS as readonly string[]).includes(cert);
}

/**
 * Serve an OTA manifest.plist for a given certificate build.
 * The IPA URL is built dynamically from the incoming request host so it
 * works identically on the dev domain and on production.
 */
router.get("/ios/manifest/:cert.plist", (req, res) => {
  const { cert } = req.params;
  if (!isValidCert(cert)) return res.status(404).json({ error: "Not found" });

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "localhost";

  const ipaUrl = `${proto}://${host}/api/ios/download/${cert}.ipa`;
  const iconUrl = `${proto}://${host}/logo.png`;

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${ipaUrl}</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>display-image</string>
          <key>needs-shine</key>
          <false/>
          <key>url</key>
          <string>${iconUrl}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>com.babism1.app</string>
        <key>bundle-version</key>
        <string>1.0.0</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>Babis M1</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;

  res.setHeader("Content-Type", "application/xml");
  res.send(plist);
});

/** Stream the IPA binary for the given certificate build. */
router.get("/ios/download/:cert.ipa", (req, res) => {
  const { cert } = req.params;
  if (!isValidCert(cert)) return res.status(404).json({ error: "Not found" });

  const ipaPath = join(IOS_DIR, "builds", `${cert}.ipa`);
  if (!existsSync(ipaPath)) {
    return res.status(404).json({
      error: "IPA not yet available. Please contact the administrator.",
    });
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="babis-m1-${cert}.ipa"`);
  res.sendFile(ipaPath);
});

/** Availability check — tells the frontend which builds are ready to install. */
router.get("/ios/status", (_req, res) => {
  const workone = existsSync(join(IOS_DIR, "builds", "workone.ipa"));
  const worktwo = existsSync(join(IOS_DIR, "builds", "worktwo.ipa"));
  res.json({ workone: { available: workone }, worktwo: { available: worktwo } });
});

export default router;
