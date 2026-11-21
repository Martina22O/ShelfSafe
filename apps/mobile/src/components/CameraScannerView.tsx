import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  CameraView,
  BarcodeScanningResult,
  BarcodeType,
  CameraMountError,
} from 'expo-camera';

export interface CameraScannerViewProps {
  enableTorch: boolean;
  barcodeTypes: BarcodeType[];
  onCameraReady?: () => void;
  onMountError?: (error: CameraMountError) => void;
  onBarcodeScanned?: (result: BarcodeScanningResult) => void;
}

const Camera = CameraView as unknown as React.ComponentType<any>;

export default function CameraScannerView({
  enableTorch,
  barcodeTypes,
  onCameraReady,
  onMountError,
  onBarcodeScanned,
}: CameraScannerViewProps) {
  const scannerSettings = useMemo(
    () => ({ barcodeTypes }),
    [barcodeTypes]
  );

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      facing="back"
      enableTorch={enableTorch}
      barcodeScannerSettings={scannerSettings}
      onCameraReady={onCameraReady}
      onMountError={onMountError}
      onBarcodeScanned={onBarcodeScanned}
    />
  );
}
