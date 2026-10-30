/**
 * Screen: ScanBarcodeScreen
 * Real camera scanner using expo-camera CameraView.
 */
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Button, ScrollView, Linking } from 'react-native';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView as ExpoCameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

const CameraView = ExpoCameraView as unknown as React.ComponentType<any>;
import { ScanStackParamList } from '../../navigation/types';
import { findProductByBarcode, getProductWithBatches } from '../../services/inventory';
import { useSaleCart } from '../../context/SaleCartContext';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanBarcode'>;

export default function ScanBarcodeScreen({ route, navigation }: Props) {
  const { mode } = route.params;
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const { addItem } = useSaleCart();

  const [torch, setTorch] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  // Single-scan lock and duplicate prevention
  const isScanningLocked = useRef(false);
  const lastScannedBarcode = useRef<string | null>(null);

  // Reset scanner lock when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      isScanningLocked.current = false;
      lastScannedBarcode.current = null;
      setErrorMessage(null);
      setStatusMessage(null);
      setNotFoundBarcode(null);
    }, [])
  );

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    const rawCode = (result.data || '').trim();
    if (!rawCode) return;
    if (isScanningLocked.current) return;
    if (lastScannedBarcode.current === rawCode) return;

    // Lock scan handler
    isScanningLocked.current = true;
    lastScannedBarcode.current = rawCode;
    setErrorMessage(null);
    setNotFoundBarcode(null);
    setStatusMessage(`Looking up barcode: ${rawCode}...`);

    const lookupResult = await findProductByBarcode(rawCode);

    if (lookupResult.kind === 'error') {
      // On network/db error: show error, release lock, allow retry
      setErrorMessage(lookupResult.message);
      setStatusMessage(null);
      isScanningLocked.current = false;
      lastScannedBarcode.current = null;
      return;
    }

    if (lookupResult.kind === 'archived') {
      // Archived product: do not navigate
      setErrorMessage('This product is archived');
      setStatusMessage(null);
      isScanningLocked.current = false;
      return;
    }

    if (mode === 'sell') {
      if (lookupResult.kind === 'not_found') {
        setStatusMessage(null);
        setNotFoundBarcode(rawCode);
        return;
      }

      if (lookupResult.kind === 'found') {
        setStatusMessage('Checking sellable stock...');
        const batchRes = await getProductWithBatches(lookupResult.product.id);

        if (batchRes.kind === 'error') {
          setErrorMessage(batchRes.message);
          setStatusMessage(null);
          isScanningLocked.current = false;
          lastScannedBarcode.current = null;
          return;
        }

        const sellableUnits = batchRes.kind === 'success' ? batchRes.data.sellable_units : 0;

        if (sellableUnits <= 0) {
          setErrorMessage('No sellable units for this product');
          setStatusMessage(null);
          isScanningLocked.current = false;
          return;
        }

        const addRes = addItem({
          id: lookupResult.product.id,
          name: lookupResult.product.name,
          barcode: lookupResult.product.barcode || rawCode,
          price: lookupResult.product.price,
          sellable_units: sellableUnits,
        });

        if (!addRes.success) {
          setErrorMessage(addRes.message);
          setStatusMessage(null);
          isScanningLocked.current = false;
          return;
        }

        setStatusMessage(null);
        navigation.navigate('SaleList');
        return;
      }
    }

    // Add mode
    if (lookupResult.kind === 'found') {
      setStatusMessage(null);
      navigation.navigate('AddStockForm', {
        productId: lookupResult.product.id,
        barcode: lookupResult.product.barcode || rawCode,
        productName: lookupResult.product.name,
      });
      return;
    }

    if (lookupResult.kind === 'not_found') {
      setStatusMessage(null);
      navigation.navigate('NewProduct', { barcode: rawCode });
      return;
    }
  };

  // 1. Permission checking
  if (!permission) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Checking camera permissions...</Text>
      </View>
    );
  }

  // 2. Permission denied state
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Camera Permission Required</Text>
        <Text style={{ color: 'gray', marginTop: 8 }}>
          ShelfSafe needs camera access to scan barcodes on packages.
        </Text>

        <View style={{ marginTop: 24, gap: 12 }}>
          {permission.canAskAgain ? (
            <Button title="Allow camera" onPress={requestPermission} />
          ) : (
            <Button title="Open settings" onPress={() => Linking.openSettings()} />
          )}

          <Button
            title="Type barcode instead"
            onPress={() => navigation.navigate('TypeBarcode', { mode })}
            color="gray"
          />
        </View>
      </View>
    );
  }

  // 3. Permission granted & ready to scan
  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Scan Barcode</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Mode: {mode === 'add' ? 'Add Stock' : 'Record Sold Items'}
      </Text>

      {/* Status Messages */}
      {statusMessage ? (
        <View style={{ marginTop: 8, padding: 8, backgroundColor: '#e8f4fd' }}>
          <Text style={{ color: '#0056b3' }}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Error Message */}
      {errorMessage ? (
        <View style={{ marginTop: 8, padding: 8, backgroundColor: '#f8d7da' }}>
          <Text style={{ color: '#721c24', fontWeight: 'bold' }}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Not Found in Sell Mode banner */}
      {notFoundBarcode ? (
        <View
          style={{
            marginTop: 8,
            padding: 12,
            borderWidth: 1,
            borderColor: '#ccc',
            backgroundColor: '#fff3cd',
          }}
        >
          <Text style={{ fontWeight: 'bold', color: '#856404' }}>
            This product is not in your inventory
          </Text>
          <Text style={{ color: 'gray', marginTop: 4 }}>
            Barcode: {notFoundBarcode}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button
              title="Search by name"
              onPress={() => {
                setNotFoundBarcode(null);
                navigation.navigate('TypeBarcode', { mode: 'sell' });
              }}
            />
            <Button
              title="Back to scanning"
              onPress={() => {
                setNotFoundBarcode(null);
                isScanningLocked.current = false;
                lastScannedBarcode.current = null;
              }}
              color="gray"
            />
          </View>
        </View>
      ) : null}

      {/* Camera View Area - rendered only when screen is focused */}
      <View
        style={{
          height: 300,
          marginTop: 16,
          backgroundColor: '#000',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          borderRadius: 4,
        }}
      >
        {isFocused ? (
          <CameraView
            style={{ width: '100%', height: '100%' }}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
            }}
            onBarcodeScanned={isScanningLocked.current ? undefined : handleBarcodeScanned}
          />
        ) : (
          <Text style={{ color: '#fff' }}>Camera paused</Text>
        )}
      </View>

      <Text style={{ textAlign: 'center', color: 'gray', marginTop: 8 }}>
        Align barcode within camera view to scan
      </Text>

      {/* Controls */}
      <View style={{ marginTop: 16, gap: 10 }}>
        <Button
          title={torch ? 'Turn Flashlight OFF' : 'Turn Flashlight ON'}
          onPress={() => setTorch(!torch)}
          color="#444"
        />

        <Button
          title="Type barcode instead"
          onPress={() => navigation.navigate('TypeBarcode', { mode })}
        />
      </View>
    </ScrollView>
  );
}
