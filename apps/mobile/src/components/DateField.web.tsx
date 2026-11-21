import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
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
  const hiddenDateInputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    if (isInteractionDisabled) return;
    Keyboard.dismiss();
    const el = hiddenDateInputRef.current;
    if (!el) return;
    try {
      if (typeof (el as any).showPicker === 'function') {
        (el as any).showPicker();
      } else {
        el.focus();
        el.click();
      }
    } catch {
      el.focus();
      el.click();
    }
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
          <input
            ref={hiddenDateInputRef}
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
            disabled={isInteractionDisabled}
            onChange={(e) => {
              if (e.target.value) {
                onChange(e.target.value);
              }
            }}
            aria-label={label}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: isInteractionDisabled ? 'not-allowed' : 'pointer',
            }}
          />
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {warning && !error ? <Text style={styles.warningText}>{warning}</Text> : null}
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
    position: 'relative',
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
});
