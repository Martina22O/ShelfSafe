/**
 * Screen: SupportTicketListScreen
 * Displays user's submitted support tickets with filtering and status indicators.
 * Matches InventoryListScreen background, fonts, and container styling.
 */
import React, { useState, useCallback } from 'react';
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
  Ticket,
  ChevronRight,
  PlusCircle,
  AlertCircle,
  Clock,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ProfileStackParamList } from '../../navigation/types';
import {
  getMyTickets,
  SupportTicket,
  SupportStatus,
} from '../../services/support';
import { COLORS, FONTS, RADIUS, SCREEN_PADDING } from '../../theme';

const RefreshControlComponent = RefreshControl as any;

type Props = NativeStackScreenProps<ProfileStackParamList, 'SupportTicketList'>;

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'] as const;

export default function SupportTicketListScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
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

  const filteredTickets = tickets.filter((t) => {
    if (selectedStatus === 'All') return true;
    return t.status === selectedStatus;
  });

  const getStatusStyle = (status: SupportStatus) => {
    switch (status) {
      case 'Open':
        return { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' };
      case 'In Progress':
        return { bg: '#E0F2FE', border: '#BAE6FD', text: '#0369A1' };
      case 'Resolved':
        return { bg: '#DCFCE7', border: '#BBF7D0', text: '#15803D' };
      case 'Closed':
        return { bg: '#F3F4F6', border: '#E5E7EB', text: '#4B5563' };
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return { text: '#DC2626' };
      case 'High':
        return { text: '#D97706' };
      case 'Medium':
        return { text: '#2563EB' };
      case 'Low':
        return { text: '#16A34A' };
      default:
        return { text: COLORS.textMuted };
    }
  };

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
          {/* Wave Background */}
          <Image
            source={require('../../../assets/designs/screen-background.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="stretch"
          />

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>My Support Tickets</Text>
              <Text style={styles.subtitle}>
                {tickets.length} {tickets.length === 1 ? 'request' : 'requests'} submitted
              </Text>
            </View>
            <TouchableOpacity
              style={styles.newBtn}
              onPress={() => navigation.navigate('NewSupportTicket')}
            >
              <PlusCircle size={16} color="#FFFFFF" />
              <Text style={styles.newBtnText}>New</Text>
            </TouchableOpacity>
          </View>

          {/* Status Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {STATUS_FILTERS.map((s) => {
              const isSelected = selectedStatus === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipSelected,
                  ]}
                  onPress={() => setSelectedStatus(s)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading tickets...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorCard}>
              <AlertCircle size={32} color={COLORS.dangerDark} />
              <Text style={styles.errorTitle}>Unable to load tickets</Text>
              <Text style={styles.errorDesc}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={loadData}
                activeOpacity={0.7}
              >
                <RotateCcw size={14} color={COLORS.white} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : tickets.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ticket size={40} color={COLORS.primary} strokeWidth={1.75} />
              </View>
              <Text style={styles.emptyTitle}>No support requests yet</Text>
              <Text style={styles.emptyDesc}>
                You haven't submitted any support requests. Need assistance? Submit a request and our support team will help you.
              </Text>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation.navigate('NewSupportTicket')}
                activeOpacity={0.8}
              >
                <PlusCircle size={16} color="#FFFFFF" />
                <Text style={styles.createBtnText}>Submit a Request</Text>
              </TouchableOpacity>
            </View>
          ) : filteredTickets.length === 0 ? (
            <View style={styles.emptyFilterCard}>
              <Text style={styles.emptyFilterText}>No tickets found for this status.</Text>
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => setSelectedStatus('All')}
                activeOpacity={0.7}
              >
                <Text style={styles.resetFilterBtnText}>Show all tickets</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredTickets.map((t) => {
              const statusStyle = getStatusStyle(t.status);
              const priorityStyle = getPriorityStyle(t.priority);
              const dateStr = new Date(t.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.ticketCard}
                  onPress={() =>
                    navigation.navigate('SupportTicketDetail', {
                      ticketId: t.id,
                      ticketNumber: t.ticket_number,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.ticketCardHeader}>
                    <View style={styles.ticketNumPill}>
                      <Text style={styles.ticketNumText}>{t.ticket_number}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusStyle.bg,
                          borderColor: statusStyle.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: statusStyle.text },
                        ]}
                      >
                        {t.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.ticketSubject} numberOfLines={2}>
                    {t.subject}
                  </Text>

                  <Text style={styles.ticketDesc} numberOfLines={2}>
                    {t.description}
                  </Text>

                  <View style={styles.ticketCardFooter}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{t.category}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text
                        style={[styles.priorityText, { color: priorityStyle.text }]}
                      >
                        {t.priority}
                      </Text>
                      <Text style={styles.dot}>•</Text>
                      <Text style={styles.dateText}>{dateStr}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  newBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  filterScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  filterChipTextSelected: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  errorCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  errorTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.dangerDark,
    marginTop: 10,
  },
  errorDesc: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  retryBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  createBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  emptyFilterCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyFilterText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  resetFilterBtn: {
    backgroundColor: COLORS.bgWarm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetFilterBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  ticketCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumPill: {
    backgroundColor: COLORS.bgWarm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ticketNumText: {
    fontSize: 12,
    fontFamily: FONTS.extraBold,
    color: COLORS.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  ticketSubject: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  ticketDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  ticketCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  categoryBadge: {
    backgroundColor: COLORS.bgTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  dot: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  dateText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textTertiary,
  },
});
