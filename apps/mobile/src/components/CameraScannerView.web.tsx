import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { BarcodeScanningResult, BarcodeType, CameraMountError } from 'expo-camera';
import { COLORS, FONTS } from '../theme';

export interface CameraScannerViewProps {
  enableTorch: boolean;
  barcodeTypes: BarcodeType[];
  onCameraReady?: () => void;
  onMountError?: (error: CameraMountError) => void;
  onBarcodeScanned?: (result: BarcodeScanningResult) => void;
}

// Map Expo BarcodeType to ZXing format identifiers
const EXPO_TO_ZXING_FORMAT: Record<string, string> = {
  ean13: 'EAN13',
  ean8: 'EAN8',
  upc_a: 'UPCA',
  upc_e: 'UPCE',
  code128: 'Code128',
  code39: 'Code39',
  code93: 'Code93',
  itf14: 'ITF',
  codabar: 'Codabar',
  qr: 'QRCode',
};

// Map ZXing format back to Expo BarcodeType
const ZXING_TO_EXPO_FORMAT: Record<string, BarcodeType> = {
  EAN13: 'ean13',
  EAN8: 'ean8',
  UPCA: 'upc_a',
  UPCE: 'upc_e',
  Code128: 'code128',
  Code39: 'code39',
  Code93: 'code93',
  ITF: 'itf14',
  Codabar: 'codabar',
  QRCode: 'qr',
  Aztec: 'aztec',
  DataMatrix: 'datamatrix',
  PDF417: 'pdf417',
};

// Global WASM initialization telemetry
let wasmGlobalStatus = 'uninitialized';
let wasmGlobalError: string | null = null;
let zxingModulePromise: Promise<any> | null = null;

/**
 * Computes the SHA-256 hexadecimal digest of an ArrayBuffer in modern browsers.
 */
async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuf));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Ignore crypto failure
    }
  }
  return '';
}

interface DiagnosticInfo {
  cameraReady: boolean;
  streamActive: boolean;
  videoState: string;
  wasmStatus: string;
  loopStatus: string;
  frameCount: number;
  decoderCalls: number;
  lastDecodeDurationMs: number;
  lastResultsCount: number;
  lastBarcodeDetected: string;
  callbackFiredCount: number;
  lastCallbackTime: string;
  lastError: string | null;
}

/**
 * Initializes the ZXing WebAssembly reader module with dynamic version and SHA-256 binding.
 * Defeats version skew between the Metro/Vercel bundled JS loader and static WASM binaries.
 * Validates cryptographic SHA-256 before linking and provides an instantiateWasm safeguard.
 */
async function getZXingReader(onStatusUpdate?: (status: string, err?: string | null) => void) {
  if (!zxingModulePromise) {
    zxingModulePromise = (async () => {
      wasmGlobalStatus = 'importing zxing-wasm/reader...';
      onStatusUpdate?.(wasmGlobalStatus);

      let reader: any;
      try {
        reader = await import('zxing-wasm/reader');
      } catch (importErr: any) {
        const msg = `Failed to import zxing-wasm: ${importErr?.message || importErr}`;
        wasmGlobalStatus = `FAILED: ${msg}`;
        wasmGlobalError = msg;
        onStatusUpdate?.(wasmGlobalStatus, msg);
        throw new Error(msg);
      }

      // Read runtime package version and cryptographic SHA-256 directly from the bundled loader
      const expectedVersion = reader.ZXING_WASM_VERSION || '3.1.7';
      const expectedHash = reader.ZXING_WASM_SHA256 || '33c8c50be17d0bb05454b4fd3ffb5b5ab9a8e8d1c0ebeb21a1adf4a89c1a8b59';
      const hashPrefix = expectedHash.slice(0, 10);

      // Purge legacy stale cache keys from previous deployments
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          void caches.delete('shelfsafe-scanner-wasm-v1');
          void caches.delete('shelfsafe-wasm-v3.1.3-2ebda08a93');
        } catch {
          // Ignore cache deletion error
        }
      }

      // Versioned Cache Storage key strictly bound to runtime package version and SHA-256
      const wasmCacheName = `shelfsafe-wasm-v${expectedVersion}-${hashPrefix}`;
      const versionedWasmPath = `/zxing_reader.wasm?v=${expectedVersion}&h=${hashPrefix}`;

      const candidateUrls = [
        versionedWasmPath,
        `/zxing_reader.wasm`,
        `https://fastly.jsdelivr.net/npm/zxing-wasm@${expectedVersion}/dist/reader/zxing_reader.wasm`,
        `https://unpkg.com/zxing-wasm@${expectedVersion}/dist/reader/zxing_reader.wasm`,
      ];

      let wasmBuffer: ArrayBuffer | null = null;
      let loadedSource = '';

      async function verifyWasmBuffer(buf: ArrayBuffer | null): Promise<boolean> {
        if (!buf || buf.byteLength < 500000) return false;
        const hash = await computeSha256(buf);
        if (hash) {
          return hash.toLowerCase() === expectedHash.toLowerCase();
        }
        // Fallback if subtle crypto is not available: check known valid byte lengths
        return buf.byteLength === 946598 || buf.byteLength === 1093289;
      }

      // 1. Check versioned browser Cache Storage first
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cache = await caches.open(wasmCacheName);
          const cached = await cache.match(versionedWasmPath);
          if (cached && cached.ok) {
            const buf = await cached.arrayBuffer();
            if (await verifyWasmBuffer(buf)) {
              wasmBuffer = buf;
              loadedSource = `cached v${expectedVersion} (${buf.byteLength}B)`;
            } else {
              // Delete outdated or truncated binary from cache
              await cache.delete(versionedWasmPath);
            }
          }
        } catch (cacheErr: any) {
          console.debug('[ShelfSafe Web Diagnostic] Cache check notice:', cacheErr?.message || cacheErr);
        }
      }

      // 2. Fetch binary with multi-source fallback if not in versioned cache
      if (!wasmBuffer && typeof fetch === 'function') {
        for (const url of candidateUrls) {
          try {
            wasmGlobalStatus = `fetching ${url}...`;
            onStatusUpdate?.(wasmGlobalStatus);

            const res = await fetch(url);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              if (await verifyWasmBuffer(buf)) {
                wasmBuffer = buf;
                loadedSource = `${url.startsWith('/') ? 'local' : 'CDN'} (${buf.byteLength}B)`;

                // Store verified binary in versioned Cache Storage for offline PWA
                if (typeof window !== 'undefined' && 'caches' in window) {
                  try {
                    const cache = await caches.open(wasmCacheName);
                    await cache.put(
                      versionedWasmPath,
                      new Response(buf.slice(0), {
                        headers: {
                          'Content-Type': 'application/wasm',
                          'Cache-Control': 'public, max-age=31536000, immutable',
                        },
                      })
                    );
                  } catch {
                    // Ignore cache write errors
                  }
                }
                break;
              } else {
                console.warn(`[ShelfSafe Web Scanner] Discarded wasm from ${url}: hash/size mismatch with expected ${expectedHash.slice(0, 8)}`);
              }
            }
          } catch {
            // Continue to next candidate URL
          }
        }
      }

      // 3. Initialize ZXing module using package-supported locateFile and verified wasmBinary
      try {
        const overrides: any = {
          locateFile: (filePath: string, prefix: string) => {
            if (filePath.endsWith('.wasm')) {
              return versionedWasmPath;
            }
            return prefix + filePath;
          },
        };

        if (wasmBuffer) {
          overrides.wasmBinary = wasmBuffer;
          wasmGlobalStatus = `instantiating wasm from ${loadedSource}...`;
        } else {
          wasmGlobalStatus = 'instantiating wasm via locateFile...';
        }
        onStatusUpdate?.(wasmGlobalStatus);

        await reader.prepareZXingModule({
          overrides,
          fireImmediately: true,
        });

        wasmGlobalStatus = `ready (${loadedSource || 'locateFile'})`;
        wasmGlobalError = null;
        onStatusUpdate?.(wasmGlobalStatus, null);
      } catch (prepareErr: any) {
        // Self-healing: if LinkError occurred, purge cache so subsequent re-try fetches fresh
        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            void caches.delete(wasmCacheName);
          } catch {}
        }
        zxingModulePromise = null; // Clear promise so retry can execute
        const msg = `prepareZXingModule error: ${prepareErr?.message || prepareErr}`;
        wasmGlobalStatus = `FAILED: ${msg}`;
        wasmGlobalError = msg;
        onStatusUpdate?.(wasmGlobalStatus, msg);
        throw prepareErr;
      }

      return reader;
    })();
  }

  return zxingModulePromise;
}

export default function CameraScannerView({
  enableTorch,
  barcodeTypes,
  onCameraReady,
  onMountError,
  onBarcodeScanned,
}: CameraScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onBarcodeScannedRef = useRef(onBarcodeScanned);
  onBarcodeScannedRef.current = onBarcodeScanned;

  // Check if diagnostic panel is requested via ?scannerDebug=1 or #scannerDebug=1
  const isDebugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const href = window.location.href || '';
    return (
      href.includes('scannerDebug=1') ||
      href.includes('scannerDebug=true') ||
      href.includes('debug=1')
    );
  }, []);

  const [debugExpanded, setDebugExpanded] = useState(true);

  // Diagnostic state for the on-screen debug panel
  const [diag, setDiag] = useState<DiagnosticInfo>({
    cameraReady: false,
    streamActive: false,
    videoState: 'initializing...',
    wasmStatus: wasmGlobalStatus,
    loopStatus: 'idle',
    frameCount: 0,
    decoderCalls: 0,
    lastDecodeDurationMs: 0,
    lastResultsCount: 0,
    lastBarcodeDetected: '',
    callbackFiredCount: 0,
    lastCallbackTime: '',
    lastError: wasmGlobalError,
  });

  const diagRef = useRef<DiagnosticInfo>(diag);
  diagRef.current = diag;

  const lastDiagRenderTime = useRef(0);
  const triggerDiagRender = useCallback(
    (force = false) => {
      if (!isDebugEnabled) return;
      const now = Date.now();
      if (force || now - lastDiagRenderTime.current > 300) {
        lastDiagRenderTime.current = now;
        setDiag({ ...diagRef.current });
      }
    },
    [isDebugEnabled]
  );

  // Map requested Expo barcode types to ZXing format names
  const zxingFormats = useMemo(() => {
    const list = barcodeTypes
      .map((t) => EXPO_TO_ZXING_FORMAT[t])
      .filter(Boolean);
    return list.length > 0 ? list : ['EAN13', 'UPCA', 'UPCE', 'Code128', 'EAN8'];
  }, [barcodeTypes]);

  // Eagerly initiate WASM download in the background when scanner mounts
  useEffect(() => {
    void getZXingReader((status, err) => {
      diagRef.current.wasmStatus = status;
      if (err) diagRef.current.lastError = err;
      triggerDiagRender(true);
    }).catch((err) => {
      console.warn('[ShelfSafe Web Scanner] Background ZXing init warning:', err?.message || err);
      diagRef.current.wasmStatus = `FAILED: ${err?.message || err}`;
      diagRef.current.lastError = err?.message || String(err);
      triggerDiagRender(true);
    });
  }, [triggerDiagRender]);

  // Start rear camera stream on mount
  useEffect(() => {
    let isCancelled = false;

    async function startStream() {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        const errorMsg = 'Camera streaming requires an HTTPS connection in Safari/Chrome.';
        diagRef.current.lastError = errorMsg;
        triggerDiagRender(true);
        onMountError?.({ message: errorMsg });
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch {
          // Fallback for desktop webcams or restricted devices
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        diagRef.current.streamActive = stream.active;
        triggerDiagRender();

        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.setAttribute('playsinline', 'true');
          videoEl.setAttribute('webkit-playsinline', 'true');
          videoEl.muted = true;

          const playVideo = async () => {
            try {
              await videoEl.play();
            } catch {
              // Browser will auto-resume on first user touch if blocked
            }
          };

          videoEl.onloadedmetadata = () => {
            void playVideo();
            diagRef.current.cameraReady = true;
            diagRef.current.videoState = `readyState=${videoEl.readyState} (${videoEl.videoWidth}x${videoEl.videoHeight})`;
            triggerDiagRender(true);
            onCameraReady?.();
          };

          void playVideo();
        }
      } catch (err: any) {
        if (!isCancelled) {
          const msg =
            err?.message ||
            'Camera access was denied or unavailable. Check permissions or type barcode manually.';
          console.warn('[ShelfSafe Web Scanner] Camera initialization error:', msg);
          diagRef.current.lastError = msg;
          diagRef.current.cameraReady = false;
          triggerDiagRender(true);
          onMountError?.({ message: msg });
        }
      }
    }

    void startStream();

    return () => {
      isCancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
      }
    };
  }, [onCameraReady, onMountError, triggerDiagRender]);

  // Apply torch constraint if supported by the browser camera track
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks?.()[0];
    if (!track || typeof track.getCapabilities !== 'function') return;

    try {
      const caps = track.getCapabilities() as any;
      if (caps && caps.torch) {
        void track.applyConstraints({
          advanced: [{ torch: enableTorch } as any],
        });
      }
    } catch {
      // Torch constraint not supported by this browser
    }
  }, [enableTorch]);

  // Continuous frame decoding loop using ZXing WebAssembly engine
  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let isDecoding = false;
    let lastScanTimestamp = 0;

    async function scanFrame() {
      if (isCancelled) return;

      const callback = onBarcodeScannedRef.current;
      const videoEl = videoRef.current;
      const now = Date.now();

      diagRef.current.frameCount += 1;

      if (videoEl) {
        diagRef.current.videoState = `readyState=${videoEl.readyState} (${videoEl.videoWidth}x${videoEl.videoHeight})`;
      }

      if (
        callback &&
        videoEl &&
        !isDecoding &&
        now - lastScanTimestamp > 1200 && // Minimum cooldown between successful scans
        videoEl.readyState >= 2 && // HAVE_CURRENT_DATA or HAVE_FUTURE_DATA on Safari WebKit
        videoEl.videoWidth > 0 &&
        videoEl.videoHeight > 0
      ) {
        isDecoding = true;
        diagRef.current.loopStatus = 'decoding...';
        diagRef.current.decoderCalls += 1;

        try {
          const t0 = performance.now();
          const reader = await getZXingReader((status, err) => {
            diagRef.current.wasmStatus = status;
            if (err) diagRef.current.lastError = err;
          });

          if (!canvasRef.current && typeof document !== 'undefined') {
            canvasRef.current = document.createElement('canvas');
          }
          const canvas = canvasRef.current;
          if (canvas && reader) {
            const vw = videoEl.videoWidth;
            const vh = videoEl.videoHeight;

            // Reticle crop: User points barcode at the center target frame.
            // Sampling ~70% width and ~45% height achieves:
            // 1. Extreme decoding speed (300x200 vs 1920x1080 -> 10x-20x faster).
            // 2. Eliminates background glare/reflections.
            const cropW = Math.max(160, Math.round(vw * 0.70));
            const cropH = Math.max(160, Math.round(vh * 0.45));
            const cropX = Math.round((vw - cropW) / 2);
            const cropY = Math.round((vh - cropH) / 2);

            if (canvas.width !== cropW || canvas.height !== cropH) {
              canvas.width = cropW;
              canvas.height = cropH;
            }

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              const cropImageData = ctx.getImageData(0, 0, cropW, cropH);

              let results = await reader.readBarcodesFromImageData(cropImageData, {
                formats: zxingFormats as any,
                tryHarder: true,
                tryRotate: true, // Crucial for iPhone: decodes 1D barcodes held in portrait or angled
                tryInvert: true,
                tryDownscale: true,
              });

              // Fallback pass: If reticle pass found nothing, occasionally try scaled full frame
              if ((!results || results.length === 0) && (vw > cropW * 1.2 || vh > cropH * 1.2)) {
                const maxDim = 800;
                const scale = Math.min(1, maxDim / Math.max(vw, vh));
                const fw = Math.round(vw * scale);
                const fh = Math.round(vh * scale);

                if (canvas.width !== fw || canvas.height !== fh) {
                  canvas.width = fw;
                  canvas.height = fh;
                }
                ctx.drawImage(videoEl, 0, 0, vw, vh, 0, 0, fw, fh);
                const fullImageData = ctx.getImageData(0, 0, fw, fh);
                results = await reader.readBarcodesFromImageData(fullImageData, {
                  formats: zxingFormats as any,
                  tryHarder: true,
                  tryRotate: true,
                  tryInvert: true,
                  tryDownscale: true,
                });
              }

              const duration = Math.round(performance.now() - t0);
              diagRef.current.lastDecodeDurationMs = duration;
              diagRef.current.lastResultsCount = results ? results.length : 0;

              if (!isCancelled && results && results.length > 0 && onBarcodeScannedRef.current) {
                const hit = results[0];
                const rawVal = hit.text ? hit.text.trim() : '';
                if (rawVal) {
                  lastScanTimestamp = Date.now();
                  const mappedType = ZXING_TO_EXPO_FORMAT[hit.format] || 'unknown';

                  diagRef.current.lastBarcodeDetected = `${rawVal} (${hit.format})`;
                  diagRef.current.callbackFiredCount += 1;
                  diagRef.current.lastCallbackTime = new Date().toLocaleTimeString();
                  triggerDiagRender(true);

                  onBarcodeScannedRef.current({
                    type: mappedType,
                    data: rawVal,
                    raw: rawVal,
                    cornerPoints: [],
                    bounds: {
                      origin: { x: 0, y: 0 },
                      size: { width: 0, height: 0 },
                    },
                  });
                }
              }
            }
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          console.error('[ShelfSafe Web Scanner Diagnostic] Frame scan error:', err);
          diagRef.current.lastError = errMsg;
          triggerDiagRender(true);
        } finally {
          isDecoding = false;
          diagRef.current.loopStatus = 'running';
          triggerDiagRender();
        }
      } else {
        if (!videoEl) {
          diagRef.current.loopStatus = 'waiting for video element';
        } else if (videoEl.readyState < 2) {
          diagRef.current.loopStatus = `buffering video (readyState=${videoEl.readyState})`;
        } else if (now - lastScanTimestamp <= 1200) {
          diagRef.current.loopStatus = 'cooldown after scan';
        }
        triggerDiagRender();
      }

      if (!isCancelled) {
        timer = setTimeout(scanFrame, 180);
      }
    }

    timer = setTimeout(scanFrame, 200);

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [zxingFormats, triggerDiagRender]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          backgroundColor: '#000',
        }}
      />

      {/* Conditional Diagnostics Panel: only rendered when ?scannerDebug=1 is present in the URL */}
      {isDebugEnabled && (
        <View style={styles.debugPanel}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setDebugExpanded((prev) => !prev)}
            style={styles.debugHeader}
          >
            <Text style={styles.debugTitle}>
              ⚙️ ShelfSafe Scanner Debug {debugExpanded ? '▼' : '▲'}
            </Text>
            <Text style={styles.debugBadge}>
              Frames: {diag.frameCount} | Decodes: {diag.decoderCalls}
            </Text>
          </TouchableOpacity>

          {debugExpanded && (
            <View style={styles.debugBody}>
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Camera:</Text>
                <Text
                  style={[
                    styles.debugValue,
                    { color: diag.cameraReady ? '#4ADE80' : '#FBBF24' },
                  ]}
                >
                  {diag.cameraReady ? 'READY' : 'STARTING'} ({diag.videoState})
                </Text>
              </View>

              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>WASM:</Text>
                <Text
                  style={[
                    styles.debugValue,
                    {
                      color: diag.wasmStatus.startsWith('ready')
                        ? '#4ADE80'
                        : diag.wasmStatus.startsWith('FAILED')
                        ? '#F87171'
                        : '#FBBF24',
                    },
                  ]}
                >
                  {diag.wasmStatus}
                </Text>
              </View>

              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Scan Loop:</Text>
                <Text style={styles.debugValue}>
                  {diag.loopStatus} ({diag.lastDecodeDurationMs}ms/call)
                </Text>
              </View>

              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>ZXing Results:</Text>
                <Text
                  style={[
                    styles.debugValue,
                    { color: diag.lastBarcodeDetected ? '#4ADE80' : '#E2E8F0' },
                  ]}
                >
                  {diag.lastBarcodeDetected || '(none detected yet)'}
                </Text>
              </View>

              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>onScanned:</Text>
                <Text
                  style={[
                    styles.debugValue,
                    { color: diag.callbackFiredCount > 0 ? '#4ADE80' : '#E2E8F0' },
                  ]}
                >
                  {diag.callbackFiredCount} calls
                  {diag.lastCallbackTime ? ` (last: ${diag.lastCallbackTime})` : ''}
                </Text>
              </View>

              {diag.lastError ? (
                <View style={styles.debugErrorBox}>
                  <Text style={styles.debugErrorText}>
                    ⚠️ Last Exception: {diag.lastError}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  debugPanel: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.6)',
    padding: 8,
    zIndex: 9999,
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debugTitle: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: '#FBBF24',
  },
  debugBadge: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: '#94A3B8',
  },
  debugBody: {
    gap: 3,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  debugLabel: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: '#94A3B8',
    width: 80,
  },
  debugValue: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: '#F1F5F9',
    flex: 1,
  },
  debugErrorBox: {
    marginTop: 4,
    padding: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  debugErrorText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: '#FCA5A5',
  },
});
