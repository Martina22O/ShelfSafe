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
  Linking,
  Modal,
  BackHandler,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { ArrowRight, Lightbulb, Flashlight, FlashlightOff } from 'lucide-react-native';
import { ScanStackParamList } from '../../navigation/types';
import { findProductByBarcode, getProductWithBatches, restoreProduct } from '../../services/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useSaleCart } from '../../context/SaleCartContext';
import { Product } from '../../types/inventory';
import { isValidRetailBarcode } from '../../utils/barcode';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

export const SCAN_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a'] as const;

const SCAN_CONFIRMATION_READS = 2;
const SCAN_CONFIRMATION_WINDOW_MS = 1200;
const SCAN_HINT_AFTER_MS = 4000;

const Camera = CameraView as unknown as React.ComponentType<any>;

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanBarcode'>;

export default function ScanBarcodeScreen({ route, navigation }: Props) {
  const { near_expiry_days } = useStoreSettings();
  const { mode } = route.params;
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const { addItem } = useSaleCart();

  const [torch, setTorch] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [showScanHint, setShowScanHint] = useState(false);

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

  // Stability tracking
  const isScanningLocked = useRef(false);
  const lastScannedBarcode = useRef<string | null>(null);
  const lastCandidateRef = useRef<{ code: string; count: number; lastSeenAt: number } | null>(null);
  const firstIgnoredAtRef = useRef<number | null>(null);

  const resetScanStability = useCallback(() => {
    lastCandidateRef.current = null;
    firstIgnoredAtRef.current = null;
    setShowScanHint(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      isScanningLocked.current = false;
      lastScannedBarcode.current = null;
      resetScanStability();
      setErrorMessage(null);
      setStatusMessage(null);
      setNotFoundBarcode(null);
      setArchivedProduct(null);
      setRestoreSuccessMessage(null);
    }, [resetScanStability])
  );

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    const rawCode = (result.data || '').trim();
    if (isScanningLocked.current) return;

    const now = Date.now();
    const recordIgnoredRead = () => {
      if (firstIgnoredAtRef.current === null) {
        firstIgnoredAtRef.current = now;
      } else if (now - firstIgnoredAtRef.current >= SCAN_HINT_AFTER_MS) {
        setShowScanHint(true);
      }
    };

    if (!rawCode || !isValidRetailBarcode(rawCode)) {
      recordIgnoredRead();
      return;
    }

    const currentCandidate = lastCandidateRef.current;
    if (
      currentCandidate &&
      currentCandidate.code === rawCode &&
      now - currentCandidate.lastSeenAt <= SCAN_CONFIRMATION_WINDOW_MS
    ) {
      currentCandidate.count += 1;
      currentCandidate.lastSeenAt = now;
    } else {
      lastCandidateRef.current = { code: rawCode, count: 1, lastSeenAt: now };
    }

    if ((lastCandidateRef.current?.count ?? 0) < SCAN_CONFIRMATION_READS) {
      return;
    }

    const barcode = rawCode;
    lastCandidateRef.current = null;
    firstIgnoredAtRef.current = null;
    setShowScanHint(false);

    if (lastScannedBarcode.current === barcode) return;

    isScanningLocked.current = true;
    lastScannedBarcode.current = barcode;
    setErrorMessage(null);
    setStatusMessage(`Scanned ${barcode}...`);

    try {
      const productRes = await findProductByBarcode(barcode);

      if (productRes.kind === 'error') {
        setErrorMessage(productRes.message);
        isScanningLocked.current = false;
        lastScannedBarcode.current = null;
        setStatusMessage(null);
        return;
      }

      if (productRes.kind === 'archived') {
        setStatusMessage(null);
        setArchivedProduct(productRes.product);
        setShowRestoreModal(true);
        return;
      }

      if (productRes.kind === 'not_found') {
        setStatusMessage(null);
        if (mode === 'add') {
          navigation.navigate('NewProduct', { barcode, fromScan: true });
        } else {
          setNotFoundBarcode(barcode);
        }
        return;
      }

      // Product found active
      const product = productRes.product;

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
          isScanningLocked.current = false;
          lastScannedBarcode.current = null;
          setStatusMessage(null);
          return;
        }

        const sellableUnits = detailRes.data.sellable_units;
        if (sellableUnits <= 0) {
          setErrorMessage(`"${product.name}" has 0 sellable units available (expired or out of stock).`);
          isScanningLocked.current = false;
          lastScannedBarcode.current = null;
          setStatusMessage(null);
          return;
        }

        addItem({
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          price: product.price,
          sellable_units: sellableUnits,
        });

        setStatusMessage(null);
        navigation.navigate('SaleList');
      }
    } catch {
      setErrorMessage('Unexpected scanner error.');
      isScanningLocked.current = false;
      lastScannedBarcode.current = null;
      setStatusMessage(null);
    }
  };

  const handleBarcodeScannedRef = useRef(handleBarcodeScanned);
  handleBarcodeScannedRef.current = handleBarcodeScanned;

  const onBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (isScanningLocked.current) return;
    handleBarcodeScannedRef.current(result);
  }, []);

  const handleConfirmRestoreArchived = async () => {
    if (!archivedProduct) return;
    setRestoring(true);
    setErrorMessage(null);

    const res = await restoreProduct(archivedProduct.id);
    setRestoring(false);

    if (res.kind !== 'success') {
      setErrorMessage(res.message);
      setShowRestoreModal(false);
      isScanningLocked.current = false;
      lastScannedBarcode.current = null;
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
      isScanningLocked.current = false;
      lastScannedBarcode.current = null;
    }
  };

  const handleCancelRestore = () => {
    setShowRestoreModal(false);
    setArchivedProduct(null);
    isScanningLocked.current = false;
    lastScannedBarcode.current = null;
    resetScanStability();
  };

  const isScanAction = mode === 'add' || mode === 'sell';

  if (!permission) {
    return (
      <SafeAreaView
        style={[styles.centerContainer, isScanAction && { backgroundColor: COLORS.scanActionBg }]}
      >
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
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
      <View style={styles.content}>
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
                  isScanningLocked.current = false;
                  lastScannedBarcode.current = null;
                  resetScanStability();
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
            <Camera
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: SCAN_BARCODE_TYPES,
              }}
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

        {showScanHint ? (
          <View style={styles.hintContainer}>
            <Lightbulb size={16} color={COLORS.amberDark} strokeWidth={2} />
            <Text style={styles.hintText}>
              Hold steady and fill the frame with the barcode. Turn on flash if dim.
            </Text>
          </View>
        ) : null}

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
      </View>

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
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 20,
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
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.amberDark,
    textAlign: 'center',
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
