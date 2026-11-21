import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Modal,
  StyleSheet,
  Keyboard,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { COLORS, FONTS } from '../theme';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  warning?: string | null;
  disabled?: boolean;
  editable?: boolean;
}

function parseYMD(str: string): Date {
  const parts = (str || '').trim().split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
  }
  return new Date();
}

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DateField({
  label,
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  error,
  warning,
  disabled = false,
  editable = true,
}: DateFieldProps) {
  const isInteractionDisabled = disabled || !editable;
  const [iosModalVisible, setIosModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parseYMD(value));

  const openPicker = () => {
    if (isInteractionDisabled) return;
    Keyboard.dismiss();
    const initialDate = parseYMD(value);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'date',
        is24Hour: true,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            onChange(formatYMD(selectedDate));
          }
        },
      });
    } else if (Platform.OS === 'ios') {
      setTempDate(initialDate);
      setIosModalVisible(true);
    }
  };

  const handleIosConfirm = () => {
    onChange(formatYMD(tempDate));
    setIosModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, isInteractionDisabled && styles.inputDisabled]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSubtle}
          editable={!isInteractionDisabled}
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <TouchableOpacity
          style={styles.calendarButton}
          onPress={openPicker}
          activeOpacity={0.7}
          disabled={isInteractionDisabled}
          accessibilityLabel={`Open calendar for ${label}`}
          accessibilityRole="button"
        >
          <Calendar size={18} color={COLORS.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {warning && !error ? <Text style={styles.warningText}>{warning}</Text> : null}

      {/* iOS Modal Picker */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={iosModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIosModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setIosModalVisible(false)}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{label}</Text>
                <TouchableOpacity
                  onPress={handleIosConfirm}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalConfirmText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
                  if (selectedDate) setTempDate(selectedDate);
                }}
                textColor={COLORS.text}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  calendarButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.dangerDark,
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 4,
  },
  warningText: {
    color: COLORS.amberDark,
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  modalButton: {
    padding: 6,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
});
