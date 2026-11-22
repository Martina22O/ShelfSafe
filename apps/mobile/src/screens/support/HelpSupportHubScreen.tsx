/**
 * Screen: HelpSupportHubScreen
 * Primary mobile hub for ShelfSafe Help & Support.
 * Uses exact background and base styling from InventoryListScreen.tsx.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  LifeBuoy,
  PlusCircle,
  Ticket,
  Clock,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ProfileStackParamList } from '../../navigation/types';
import {
  getMyTickets,
  SupportTicket,
  SUPPORT_HOURS_INFO,
} from '../../services/support';
import { COLORS, FONTS, RADIUS, SCREEN_PADDING } from '../../theme';

const RefreshControlComponent = RefreshControl as any;

type Props = NativeStackScreenProps<ProfileStackParamList, 'HelpSupportHub'>;

export default function HelpSupportHubScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    const res = await getMyTickets();
    setLoading(false);
    setRefreshing(false);

    if (res.success && res.data) {
      setTickets(res.data);
    } else {
      setError(res.error || 'Unable to load tickets');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openTickets = tickets.filter(
    (t) => t.status === 'Open' || t.status === 'In Progress'
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControlComponent
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Wave Background Image */}
          <Image
            source={require('../../../assets/designs/screen-background.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="stretch"
          />

          {/* Header Description */}
          <View style={styles.header}>
            <Text style={styles.subtitle}>
              Contact support personnel, submit concerns, and track resolutions.
            </Text>
          </View>

          {/* Action Cards */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => navigation.navigate('NewSupportTicket')}
              activeOpacity={0.85}
            >
              <View style={styles.btnIconWrap}>
                <PlusCircle size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.primaryActionTitle}>Submit a Request</Text>
                <Text style={styles.primaryActionDesc}>
                  Report errors, inventory concerns, or general inquiries
                </Text>
              </View>
              <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.secondaryActionRow}
              onPress={() => navigation.navigate('SupportTicketList')}
              activeOpacity={0.7}
            >
              <View style={styles.rowIconWrap}>
                <Ticket size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>My Support Tickets</Text>
                <Text style={styles.rowDesc}>
                  {tickets.length === 0
                    ? 'No requests submitted yet'
                    : `${tickets.length} total • ${openTickets.length} active`}
                </Text>
              </View>
              {openTickets.length > 0 && (
                <View style={styles.activeCountBadge}>
                  <Text style={styles.activeCountText}>{openTickets.length}</Text>
                </View>
              )}
              <ChevronRight size={18} color={COLORS.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Support Availability Card */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={styles.badgeIconWrap}>
                <Clock size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.cardTitle}>Support Availability</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Support Hours</Text>
              <Text style={styles.infoValue}>{SUPPORT_HOURS_INFO.hours}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Timezone</Text>
              <Text style={styles.infoValue}>{SUPPORT_HOURS_INFO.timezone}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Initial Response Target</Text>
              <Text style={styles.infoValueHighlight}>Within 1 business day</Text>
            </View>

            <View style={styles.noteBox}>
              <AlertCircle size={14} color={COLORS.textMuted} style={{ marginTop: 2 }} />
              <Text style={styles.noteText}>{SUPPORT_HOURS_INFO.disclaimer}</Text>
            </View>
          </View>

          {/* Recent Open Tickets Preview */}
          {openTickets.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <View style={styles.badgeIconWrap}>
                  <LifeBuoy size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.cardTitle}>Active Support Tickets</Text>
              </View>

              {openTickets.slice(0, 3).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.ticketPreviewRow}
                  onPress={() =>
                    navigation.navigate('SupportTicketDetail', {
                      ticketId: item.id,
                      ticketNumber: item.ticket_number,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={styles.ticketNumRow}>
                      <Text style={styles.ticketNumText}>{item.ticket_number}</Text>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{item.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.ticketSubject} numberOfLines={1}>
                      {item.subject}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{item.status}</Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
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
    paddingTop: 4,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  primaryActionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnIconWrap: {
    marginRight: 12,
  },
  primaryActionTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  primaryActionDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.bgTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  rowDesc: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  activeCountBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  activeCountText: {
    color: COLORS.white,
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: COLORS.bgTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  infoValueHighlight: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  noteBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgWarm,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  ticketPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  ticketNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  ticketNumText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  categoryPill: {
    backgroundColor: COLORS.bgTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  ticketSubject: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: '#B45309',
  },
});
