/**
 * Screen: NewSupportTicketScreen
 * Allows users to submit a new Help & Support ticket with optional screenshot.
 * Matches InventoryListScreen background, fonts, and container styling.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Send,
  Camera,
  Image as ImageIcon,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import {
  createSupportTicket,
  uploadSupportAttachment,
  SUPPORT_CATEGORIES,
  SupportCategory,
} from '../../services/support';
import { COLORS, FONTS, RADIUS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'NewSupportTicket'>;

export default function NewSupportTicketScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);

  const [category, setCategory] = useState<SupportCategory>('System Errors');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Please allow photo library access to attach a screenshot.'
        );
        return;
      }

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
          setPhotoUri(`data:${mime};base64,${asset.base64}`);
        } else {
          setPhotoUri(asset.uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Please allow camera access to take a screenshot or photo.'
        );
        return;
      }

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
          setPhotoUri(`data:${mime};base64,${asset.base64}`);
        } else {
          setPhotoUri(asset.uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const trimmedSubject = subject.trim();
    const trimmedDesc = description.trim();

    if (!trimmedSubject) {
      setError('Please enter a subject for your request.');
      return;
    }
    if (trimmedSubject.length < 3 || trimmedSubject.length > 150) {
      setError('Subject must be between 3 and 150 characters.');
      return;
    }
    if (!trimmedDesc) {
      setError('Please enter a detailed description of the issue.');
      return;
    }
    if (trimmedDesc.length < 10) {
      setError('Description must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      let attachmentUrl: string | null = null;
      if (photoUri) {
        const uploadRes = await uploadSupportAttachment(photoUri, 'support_issue.jpg');
        if (uploadRes.success && uploadRes.url) {
          attachmentUrl = uploadRes.url;
        }
      }

      const res = await createSupportTicket({
        category,
        subject: trimmedSubject,
        description: trimmedDesc,
        attachmentUrl,
      });

      setSubmitting(false);

      if (res.success && res.data) {
        Alert.alert(
          'Request Submitted!',
          `Your ticket ${res.data.ticket_number} has been created. Our team will review it within one business day.`,
          [
            {
              text: 'View Ticket',
              onPress: () =>
                navigation.replace('SupportTicketDetail', {
                  ticketId: res.data!.id,
                  ticketNumber: res.data!.ticket_number,
                }),
            },
          ]
        );
      } else {
        setError(res.error || 'Failed to submit support request');
      }
    } catch (err: any) {
      setSubmitting(false);
      setError(err?.message || 'Unexpected error occurred');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Wave Background */}
          <Image
            source={require('../../../assets/designs/screen-background.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="stretch"
          />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Submit a Request</Text>
            <Text style={styles.subtitle}>
              Describe your question or issue in detail. We will investigate promptly.
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={COLORS.dangerDark} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form Card */}
          <View style={styles.card}>
            {/* Category Selector */}
            <Text style={styles.fieldLabel}>Issue Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {SUPPORT_CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Subject Input */}
            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Brief summary of the issue"
              placeholderTextColor={COLORS.textTertiary}
              value={subject}
              onChangeText={setSubject}
              maxLength={150}
              editable={!submitting}
            />

            {/* Description Input */}
            <Text style={styles.fieldLabel}>Detailed Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="What happened? Include product names, steps to reproduce, or any error messages shown..."
              placeholderTextColor={COLORS.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!submitting}
            />

            {/* Attachment Section */}
            <Text style={styles.fieldLabel}>Optional Screenshot / Photo</Text>
            {photoUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: photoUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setPhotoUri(null)}
                >
                  <X size={16} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.attachmentBtnRow}>
                <TouchableOpacity
                  style={styles.attachmentBtn}
                  onPress={handleTakePhoto}
                  disabled={submitting}
                >
                  <Camera size={16} color={COLORS.primary} />
                  <Text style={styles.attachmentBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentBtn}
                  onPress={handlePickImage}
                  disabled={submitting}
                >
                  <ImageIcon size={16} color={COLORS.primary} />
                  <Text style={styles.attachmentBtnText}>Choose Image</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Send size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Submit Support Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  safeArea: {
    flex: 1,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 8,
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bgWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  categoryChipTextSelected: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
  textInput: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 100,
  },
  attachmentBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  attachmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
  },
  attachmentBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  imagePreviewWrap: {
    position: 'relative',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    height: 140,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: RADIUS.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.dangerDark,
  },
});
