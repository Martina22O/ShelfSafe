/**
 * Screen: ScanBarcodeScreen
 * Reference: docs/design/mobile/04-scan/scan_mobile.png
 * Features:
 * - Real camera scanner using expo-camera CameraView
 * - Reticle targeting frame with amber markers
 * - Flashlight toggle with active pill indicator
 * - Mode header (Stock In vs Record Sale)
 * - Manual barcode entry CTA
 * - Stability checks and restore flow
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Linking,
  Modal,
  BackHandler,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useCameraPermissions,
  BarcodeScanningResult,
  BarcodeType,
  CameraMountError,
} from 'expo-camera';
import { ArrowRight, Flashlight, FlashlightOff } from 'lucide-react-native';
import { ScanStackParamList } from '../../navigation/types';
import { findProductByBarcode, getProductWithBatches, restoreProduct } from '../../services/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useSaleCart } from '../../context/SaleCartContext';
import { Product } from '../../types/inventory';
import { extractScannedBarcode, isPlausibleScannedBarcode } from '../../utils/barcode';
import CameraScannerView from '../../components/CameraScannerView';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

export const SCAN_BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'qr',
];

const DUPLICATE_SCAN_COOLDOWN_MS = 1500;

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanBarcode'>;

export default function ScanBarcodeScreen({ route, navigation }: Props) {
  const { near_expiry_days } = useStoreSettings();
  const { mode } = route.params;
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const { addItem } = useSaleCart();

  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  // Archived product restore state
  const [archivedProduct, setArchivedProduct] = useState<Product | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);

  // Prevent back navigation while restoring
  useEffect(() => {
    const backAction = () => {
      if (restoring) return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [restoring]);

  // Synchronous scan lock & controlled cooldown timer
  const isScanningLocked = useRef(false);
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const unlockScannerWithCooldown = useCallback(
    (code?: string, delayMs = DUPLICATE_SCAN_COOLDOWN_MS) => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
      if (code) {
        lastScannedRef.current = { code, timestamp: Date.now() };
      }
      cooldownTimerRef.current = setTimeout(() => {
        isScanningLocked.current = false;
        setIsProcessingScan(false);
        cooldownTimerRef.current = null;
      }, delayMs);
    },
    []
  );

  const resetScannerImmediately = useCallback(() => {
    clearTimers();
    isScanningLocked.current = false;
    lastScannedRef.current = null;
    setIsProcessingScan(false);
  }, [clearTimers]);

  useFocusEffect(
    useCallback(() => {
      resetScannerImmediately();
      setCameraReady(false);
      setCameraMountError(null);
      setErrorMessage(null);
      setStatusMessage(null);
      setNotFoundBarcode(null);
      setArchivedProduct(null);
      setRestoreSuccessMessage(null);

      return () => {
        clearTimers();
        isScanningLocked.current = false;
      };
    }, [resetScannerImmediately, clearTimers])
  );

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
    setCameraMountError(null);
    console.log('[ShelfSafe Scanner] Camera ready event (mode:', mode, ', barcodeTypes:', SCAN_BARCODE_TYPES.length, ')');
  }, [mode]);

  const handleCameraMountError = useCallback((event: CameraMountError) => {
    const msg = event?.message || 'Camera preview could not be started.';
    setCameraReady(false);
    setCameraMountError(msg);
    setErrorMessage(msg);
    console.warn('[ShelfSafe Scanner] Camera mount error:', msg);
  }, []);

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (!isFocused || isScanningLocked.current || showRestoreModal) {
      return;
    }

    const barcode = extractScannedBarcode(result);
    const barcodeType = result?.type || 'unknown';

    if (!barcode || !isPlausibleScannedBarcode(barcode)) {
      console.log('[ShelfSafe Scanner] Ignored empty/invalid scan payload:', {
        type: barcodeType,
        hasData: Boolean(result?.data),
      });
      return;
    }

    const now = Date.now();
    if (
      lastScannedRef.current &&
      lastScannedRef.current.code === barcode &&
      now - lastScannedRef.current.timestamp < DUPLICATE_SCAN_COOLDOWN_MS
    ) {
      console.log('[ShelfSafe Scanner] Ignored duplicate barcode within cooldown period');
      return;
    }

    // Lock synchronously to prevent duplicate concurrent database lookups
    isScanningLocked.current = true;
    lastScannedRef.current = { code: barcode, timestamp: now };
    setIsProcessingScan(true);
    setNotFoundBarcode(null);
    setErrorMessage(null);
    setStatusMessage(`Scanned ${barcode}...`);

    console.log('[ShelfSafe Scanner] Barcode accepted, starting product lookup:', {
      type: barcodeType,
      barcodeLength: barcode.length,
      mode,
    });

    try {
      const productRes = await findProductByBarcode(barcode);

      if (productRes.kind === 'error') {
        if (__DEV__) {
          console.warn('[ShelfSafe Scanner] Lookup error:', productRes.message);
        }
        setErrorMessage(productRes.message);
        setStatusMessage(null);
        unlockScannerWithCooldown(barcode);
        return;
      }

      if (productRes.kind === 'archived') {
        if (__DEV__) {
          console.log('[ShelfSafe Scanner] Lookup result: Archived product', productRes.product.id);
        }
        setStatusMessage(null);
        setArchivedProduct(productRes.product);
        setShowRestoreModal(true);
        return;
      }

      if (productRes.kind === 'not_found') {
        if (__DEV__) {
          console.log('[ShelfSafe Scanner] Lookup result: Not found for barcode', barcode);
        }
        setStatusMessage(null);
        if (mode === 'add') {
          navigation.navigate('NewProduct', { barcode, fromScan: true });
        } else {
          setNotFoundBarcode(barcode);
          // Release lock after short cooldown so user can scan another product immediately
          unlockScannerWithCooldown(barcode);
        }
        return;
      }

      // Product found active
      const product = productRes.product;
      if (__DEV__) {
        console.log('[ShelfSafe Scanner] Lookup result: Active product found', {
          id: product.id,
          name: product.name,
        });
      }

      if (mode === 'add') {
        setStatusMessage(null);
        navigation.navigate('AddStockForm', {
          productId: product.id,
          barcode: product.barcode || barcode,
          productName: product.name,
        });
      } else {
        // Mode === 'sell'
        const detailRes = await getProductWithBatches(product.id, near_expiry_days);
        if (detailRes.kind === 'error' || detailRes.kind === 'not_found') {
          setErrorMessage('Failed to load active batch details.');
          setStatusMessage(null);
          unlockScannerWithCooldown(barcode);
          return;
        }

        const sellableUnits = detailRes.data.sellable_units;
        if (sellableUnits <= 0) {
          setErrorMessage(`"${product.name}" has 0 sellable units available (expired or out of stock).`);
          setStatusMessage(null);
          unlockScannerWithCooldown(barcode);
          return;
        }

        const addRes = addItem({
          id: product.id,
          name: product.name,
          barcode: product.barcode || barcode,
          price: product.price,
          sellable_units: sellableUnits,
        });

        if (!addRes.success) {
          setErrorMessage(addRes.message);
          setStatusMessage(null);
          unlockScannerWithCooldown(barcode);
          return;
        }

        setStatusMessage(null);
        navigation.navigate('SaleList');
      }
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[ShelfSafe Scanner] Unexpected error:', err?.message);
      }
      setErrorMessage('Unexpected scanner error.');
      setStatusMessage(null);
      unlockScannerWithCooldown(barcode);
    }
  };

  const handleBarcodeScannedRef = useRef(handleBarcodeScanned);
  handleBarcodeScannedRef.current = handleBarcodeScanned;

  const onBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    const rawType = result?.type || 'unknown';
    const rawBarcode = extractScannedBarcode(result);

    console.log('[ShelfSafe Scanner] Native barcode callback received:', {
      type: rawType,
      barcode: rawBarcode,
      hasData: Boolean(result?.data),
      rawLen: result?.data?.length || 0,
      isLocked: isScanningLocked.current,
      isFocused,
    });

    if (!isFocused || isScanningLocked.current || showRestoreModal) {
      console.log('[ShelfSafe Scanner] Callback bypassed due to scanner lock / unfocused');
      return;
    }

    void handleBarcodeScannedRef.current(result);
  }, [isFocused, showRestoreModal]);

  const handleConfirmRestoreArchived = async () => {
    if (!archivedProduct) return;
    setRestoring(true);
    setErrorMessage(null);

    const res = await restoreProduct(archivedProduct.id);
    setRestoring(false);

    if (res.kind !== 'success') {
      setErrorMessage(res.message);
      setShowRestoreModal(false);
      resetScannerImmediately();
      return;
    }

    setShowRestoreModal(false);
    const restoredProd = archivedProduct;
    setArchivedProduct(null);

    if (mode === 'add') {
      navigation.navigate('AddStockForm', {
        productId: restoredProd.id,
        barcode: restoredProd.barcode || undefined,
        productName: restoredProd.name,
      });
    } else {
      setRestoreSuccessMessage(
        `"${restoredProd.name}" restored to inventory! Scan again or type barcode to add it to your sale.`
      );
      resetScannerImmediately();
    }
  };

  const handleCancelRestore = () => {
    setShowRestoreModal(false);
    setArchivedProduct(null);
    resetScannerImmediately();
  };

  const isScanAction = mode === 'add' || mode === 'sell';
  const isWeb = Platform.OS === 'web';

  if (!isWeb && !permission) {
    return (
      <SafeAreaView
        style={[styles.centerContainer, isScanAction && { backgroundColor: COLORS.scanActionBg }]}
      >
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!isWeb && permission && !permission.granted) {
    return (
      <SafeAreaView
        style={[styles.centerContainer, isScanAction && { backgroundColor: COLORS.scanActionBg }]}
      >
        <View style={styles.permCard}>
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permDesc}>
            ShelfSafe needs camera access to scan retail product barcodes.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.primaryButtonText}>Open Device Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, isScanAction && { backgroundColor: COLORS.scanActionBg }]}
      edges={['left', 'right']}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Mode Badge Indicator (Native navigation bar provides single Back button) */}
        <View style={styles.header}>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>
              {mode === 'add' ? 'Stock In Mode' : 'Record Sale Mode'}
            </Text>
          </View>
        </View>

        {/* Clear non-repetitive instructional title */}
        <Text style={styles.screenTitle}>Position barcode inside frame</Text>
        <Text style={styles.screenSubtitle}>
          {mode === 'add'
            ? 'Hold camera steady to add new batch stock'
            : 'Hold camera steady to record sale deduction'}
        </Text>

        {/* Notifications & Banners */}
        {statusMessage ? (
          <View style={styles.statusToast}>
            <Text style={styles.statusToastText}>{statusMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorToast}>
            <Text style={styles.errorToastText}>{errorMessage}</Text>
          </View>
        ) : null}

        {restoreSuccessMessage ? (
          <View style={styles.successToast}>
            <Text style={styles.successToastText}>{restoreSuccessMessage}</Text>
          </View>
        ) : null}

        {/* Not Found In Inventory Banner */}
        {notFoundBarcode ? (
          <View style={styles.notFoundBox}>
            <Text style={styles.notFoundTitle}>Product Not in Inventory</Text>
            <Text style={styles.notFoundSub}>Barcode: {notFoundBarcode}</Text>
            <View style={styles.notFoundBtnRow}>
              <TouchableOpacity
                style={styles.notFoundBtn}
                onPress={() => {
                  setNotFoundBarcode(null);
                  navigation.navigate('TypeBarcode', { mode: 'sell' });
                }}
              >
                <Text style={styles.notFoundBtnText}>Search by Name</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.notFoundBtn, { backgroundColor: COLORS.bgWarm }]}
                onPress={() => {
                  setNotFoundBarcode(null);
                  resetScannerImmediately();
                }}
              >
                <Text style={[styles.notFoundBtnText, { color: COLORS.text }]}>Resume Scan</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Camera Viewfinder Card with Targeting Frame */}
        <View style={styles.viewfinderCard}>
          {isFocused ? (
            <CameraScannerView
              enableTorch={torch}
              barcodeTypes={SCAN_BARCODE_TYPES}
              onCameraReady={handleCameraReady}
              onMountError={handleCameraMountError}
              onBarcodeScanned={onBarcodeScanned}
            />
          ) : (
            <Text style={{ color: COLORS.white }}>Camera paused</Text>
          )}

          {/* Reticle Frame Overlay */}
          <View style={styles.reticleFrame} pointerEvents="none">
            <View style={[styles.cornerMarker, styles.cornerTL]} />
            <View style={[styles.cornerMarker, styles.cornerTR]} />
            <View style={[styles.cornerMarker, styles.cornerBL]} />
            <View style={[styles.cornerMarker, styles.cornerBR]} />
            <View style={styles.laserGuide} />
          </View>
        </View>

        {/* Controls (Flashlight & Manual Entry) */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.torchButton, torch && styles.torchButtonActive]}
            onPress={() => setTorch(!torch)}
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
          >
            {torch ? (
              <Flashlight size={18} color={COLORS.amberDark} strokeWidth={2} />
            ) : (
              <FlashlightOff size={18} color={COLORS.textSecondary} strokeWidth={2} />
            )}
            <Text style={[styles.torchText, torch && styles.torchTextActive]}>
              {torch ? 'Flashlight ON' : 'Flashlight OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => navigation.navigate('TypeBarcode', { mode })}
            accessibilityRole="button"
          >
            <Text style={styles.manualButtonText}>Type Barcode Manually</Text>
            <ArrowRight size={16} color={COLORS.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Restore Archived Product Modal */}
      <Modal visible={showRestoreModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Archived Product Detected</Text>
            <Text style={styles.modalDesc}>
              "{archivedProduct?.name}" is currently archived. Restore it to inventory to continue?
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={handleCancelRestore}
                disabled={restoring}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleConfirmRestoreArchived}
                disabled={restoring}
              >
                {restoring ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Restore & Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    padding: 24,
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 10,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 6,
  },
  backBtn: {
    paddingVertical: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modeBadge: {
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 18,
  },
  statusToast: {
    backgroundColor: COLORS.bgTint,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusToastText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  errorToast: {
    backgroundColor: COLORS.dangerLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorToastText: {
    color: COLORS.dangerDark,
    fontSize: 12,
    fontWeight: '600',
  },
  successToast: {
    backgroundColor: COLORS.bgTint,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  successToastText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  notFoundBox: {
    backgroundColor: COLORS.amberLight,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  notFoundTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.amberDark,
  },
  notFoundSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  notFoundBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  notFoundBtn: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notFoundBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  viewfinderCard: {
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  reticleFrame: {
    width: 240,
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  cornerMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: COLORS.amber,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 8,
  },
  laserGuide: {
    width: '90%',
    height: 1.5,
    backgroundColor: COLORS.amber,
    opacity: 0.8,
  },
  controlsRow: {
    gap: 10,
    marginTop: 8,
  },
  torchButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 13,
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  torchButtonActive: {
    backgroundColor: COLORS.amberLight,
    borderColor: COLORS.amber,
  },
  torchText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  torchTextActive: {
    color: COLORS.amberDark,
  },
  manualButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manualButtonText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  permCard: {
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    maxWidth: 320,
  },
  permTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  permDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modalPrimaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
