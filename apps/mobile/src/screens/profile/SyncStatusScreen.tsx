/**
 * Screen: SyncStatusScreen
 * Simple and honest connection status based on real server checks.
 * Displays last successful load timestamp in Asia/Manila time.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
// Lucide icons
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { getStoreSettings } from '../../services/storeSettings';
import { formatManilaDateTime } from '../../utils/date';
import { useRealtime } from '../../services/realtime';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SyncStatus'>;

type ConnectionState = 'idle' | 'checking' | 'connected' | 'error';

export default function SyncStatusScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { lastLoadedAt, refresh } = useStoreSettings();
  const { status, lastChangeAt } = useRealtime();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    lastLoadedAt ? 'connected' : 'idle'
  );
  const [checking, setChecking] = useState(false);

  const handleCheckNow = useCallback(async () => {
    setChecking(true);
    setConnectionState('checking');

    const res = await getStoreSettings();

    if (res.kind === 'success') {
      await refresh();
      setConnectionState('connected');
    } else {
      setConnectionState('error');
    }

    setChecking(false);
  }, [refresh]);

  useEffect(() => {
    handleCheckNow();
  }, [handleCheckNow]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <Image
        source={require('../../../assets/designs/screen-background.png')}
        style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
        resizeMode="stretch"
      />
      <View style={styles.content}>
        <Text style={[styles.screenSub, { marginTop: 12 }]}>
          Live heartbeat status with the central store database
        </Text>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Server Connection</Text>

          {connectionState === 'checking' && (
            <View style={styles.statusStateRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.checkingText}>
                Checking database connection...
              </Text>
            </View>
          )}

          {connectionState === 'connected' && (
            <View style={styles.statusBoxSuccess}>
              <View style={styles.bulletSuccess} />
              <Text style={styles.statusTextSuccess}>
                Connected • Database online & responsive
              </Text>
            </View>
          )}

          {connectionState === 'error' && (
            <View style={styles.statusBoxError}>
              <View style={styles.bulletError} />
              <Text style={styles.statusTextError}>
                Disconnected • Could not reach the server
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last synchronized:</Text>
            <Text style={styles.detailValue}>
              {lastLoadedAt
                ? formatManilaDateTime(lastLoadedAt)
                : 'Not synced this session'}
            </Text>
          </View>
        </View>

        {/* Live Updates Card */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.cardHeader}>Live Updates</Text>

          {status === 'live' && (
            <View style={styles.statusBoxSuccess}>
              <View style={styles.bulletSuccess} />
              <Text style={styles.statusTextSuccess}>
                Live updates: On
              </Text>
            </View>
          )}

          {status === 'connecting' && (
            <View style={styles.statusBoxWarning}>
              <ActivityIndicator size="small" color={COLORS.amberDark} />
              <Text style={styles.statusTextWarning}>
                Live updates: Reconnecting...
              </Text>
            </View>
          )}

          {status === 'offline' && (
            <View style={styles.statusBoxError}>
              <View style={styles.bulletError} />
              <Text style={styles.statusTextError}>
                Live updates: Off
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last change received:</Text>
            <Text style={styles.detailValue}>
              {lastChangeAt
                ? formatManilaDateTime(lastChangeAt.toISOString())
                : 'None received yet'}
            </Text>
          </View>

          <Text style={styles.honestNote}>
            Live updates keep your screens in sync when other devices make changes. You can still pull down to refresh at any time.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnStack}>
          <TouchableOpacity
            style={[styles.primaryBtn, checking && styles.btnDisabled]}
            onPress={handleCheckNow}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Check Connection Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 24,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topNav: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
    marginBottom: 12,
  },
  statusStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  checkingText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  statusBoxSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 12,
    padding: 12,
  },
  bulletSuccess: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  statusTextSuccess: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primaryDark,
  },
  statusBoxError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 12,
    padding: 12,
  },
  bulletError: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    marginRight: 8,
  },
  statusTextError: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },
  statusBoxWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.amberLight,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  statusTextWarning: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.amberDark,
  },
  honestNote: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 14,
  },
  detailRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 2,
  },
  btnStack: {
    marginTop: 24,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
