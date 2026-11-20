import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, RefreshCw, Trash2 } from 'lucide-react-native';
import ProductCategoryIcon from './ProductCategoryIcon';
import { COLORS, FONTS } from '../theme';

interface ProductPhotoPickerProps {
  photoUri: string | null;
  onPhotoSelected: (uri: string | null) => void;
  categoryName?: string | null;
  disabled?: boolean;
}

export default function ProductPhotoPicker({
  photoUri,
  onPhotoSelected,
  categoryName,
  disabled = false,
}: ProductPhotoPickerProps) {
  const [loading, setLoading] = useState(false);

  const handleTakePhoto = async () => {
    if (disabled) return;
    try {
      setLoading(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Needed',
          'ShelfSafe needs camera access to capture a product photo. You can enable it in your device settings.'
        );
        setLoading(false);
        return;
      }

      // Do NOT crop automatically to a square: preserve packaging aspect ratio
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const isPng = /\.png($|\?)/i.test(asset.uri || '');
          const isWebp = /\.webp($|\?)/i.test(asset.uri || '');
          const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
          onPhotoSelected(`data:${mime};base64,${asset.base64}`);
        } else {
          onPhotoSelected(asset.uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open camera. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseFromGallery = async () => {
    if (disabled) return;
    try {
      setLoading(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photos Permission Needed',
          'ShelfSafe needs photo library access to select a product photo. You can enable it in your device settings.'
        );
        setLoading(false);
        return;
      }

      // Do NOT crop automatically to a square: preserve packaging aspect ratio
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const isPng = /\.png($|\?)/i.test(asset.uri || '');
          const isWebp = /\.webp($|\?)/i.test(asset.uri || '');
          const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
          onPhotoSelected(`data:${mime};base64,${asset.base64}`);
        } else {
          onPhotoSelected(asset.uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open photo gallery. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    if (disabled) return;
    onPhotoSelected(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Product Photo (Optional)</Text>

      <View style={styles.card}>
        {/* Preview / Placeholder container (Square container with cover mode) */}
        <View style={styles.previewContainer}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : (
            <ProductCategoryIcon
              categoryName={categoryName}
              size={36}
              style={styles.placeholderIcon}
            />
          )}

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          )}
        </View>

        {/* Action Buttons Column */}
        <View style={styles.actionsColumn}>
          {photoUri ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.replaceBtn]}
                onPress={handleChooseFromGallery}
                disabled={disabled || loading}
                accessibilityRole="button"
                accessibilityLabel="Replace photo"
              >
                <RefreshCw size={14} color={COLORS.deepGreen} strokeWidth={2} />
                <Text style={styles.replaceBtnText}>Replace</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.removeBtn]}
                onPress={handleRemove}
                disabled={disabled || loading}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Trash2 size={14} color={COLORS.dangerDark} strokeWidth={2} />
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonStack}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryChoiceBtn]}
                onPress={handleTakePhoto}
                disabled={disabled || loading}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
              >
                <Camera size={15} color={COLORS.deepGreen} strokeWidth={2} />
                <Text style={styles.primaryChoiceBtnText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.secondaryChoiceBtn]}
                onPress={handleChooseFromGallery}
                disabled={disabled || loading}
                accessibilityRole="button"
                accessibilityLabel="Choose from gallery"
              >
                <ImageIcon size={15} color={COLORS.textMuted} strokeWidth={2} />
                <Text style={styles.secondaryChoiceBtnText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.helperText}>
            {photoUri
              ? 'Photo will be saved with this product.'
              : 'Add packaging photo or use category icon.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    gap: 12,
  },
  previewContainer: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.canvas,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  buttonStack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  primaryChoiceBtn: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
  },
  primaryChoiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  secondaryChoiceBtn: {
    backgroundColor: COLORS.canvas,
    borderColor: COLORS.border,
  },
  secondaryChoiceBtnText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  replaceBtn: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
  },
  replaceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  removeBtn: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.dangerBorder,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.dangerDark,
  },
  helperText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
