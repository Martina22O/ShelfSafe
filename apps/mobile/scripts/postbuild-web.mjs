import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndexPath = path.resolve(__dirname, '../dist/index.html');

if (!fs.existsSync(distIndexPath)) {
  console.error('[postbuild-web] dist/index.html not found at:', distIndexPath);
  process.exit(1);
}

let html = fs.readFileSync(distIndexPath, 'utf8');

// Replace standard viewport with iPhone safe-area and non-zooming standalone PWA viewport
html = html.replace(
  /<meta\s+name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
);

const pwaHeadTags = `
    <!-- ShelfSafe iPhone PWA & Standalone Meta -->
    <meta name="theme-color" content="#254E06" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="ShelfSafe" />
    <meta name="application-name" content="ShelfSafe" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/pwa-192x192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/pwa-512x512.png" />
    <style id="shelfsafe-pwa-styles">
      html, body, #root {
        background-color: #FEF9F0;
        width: 100%;
        height: 100%;
        height: 100dvh;
        margin: 0;
        padding: 0;
        overflow: hidden;
        overscroll-behavior-y: none;
        -webkit-tap-highlight-color: transparent;
      }
      input, textarea {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
        pointer-events: auto !important;
        touch-action: manipulation;
      }
      @supports (-webkit-touch-callout: none) {
        input, textarea {
          font-size: 16px !important;
        }
      }
    </style>`;

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${pwaHeadTags}\n  </head>`);
}

fs.writeFileSync(distIndexPath, html, 'utf8');
console.log('[postbuild-web] Injected ShelfSafe iPhone PWA manifest, icons, and safe-area meta tags into dist/index.html');

// Verify exported PWA manifest, icons, JS bundles, and WASM decoder
const distDir = path.resolve(__dirname, '../dist');
const manifestPath = path.join(distDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log(`[postbuild-web] Verified manifest.json: name="${manifest.name}", short_name="${manifest.short_name}", display="${manifest.display}"`);

for (const icon of manifest.icons) {
  const iconFile = path.join(distDir, icon.src.replace(/^\//, ''));
  const buf = fs.readFileSync(iconFile);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  console.log(`[postbuild-web] Verified icon ${icon.src}: ${w}x${h} (${buf.length} bytes)`);
}

const wasmFile = path.join(distDir, 'zxing_reader.wasm');
console.log(`[postbuild-web] Verified zxing_reader.wasm: ${fs.statSync(wasmFile).size} bytes`);

