/**
 * Screen: SupportTicketDetailScreen
 * Shows detailed ticket status, screenshot, communication history,
 * and allows user to send follow-up replies or close the ticket.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  StyleSheet,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Send,
  Camera,
  Image as ImageIcon,
  X,
  Clock,
  User,
  Headphones,
  CheckCircle2,
  AlertCircle,
  Check,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import {
  getTicketDetails,
  getTicketMessages,
  sendTicketMessage,
  closeOwnTicket,
  uploadSupportAttachment,
  SupportTicket,
  SupportTicketMessage,
} from '../../services/support';
import { COLORS, FONTS, RADIUS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SupportTicketDetail'>;

export default function SupportTicketDetailScreen({ route, navigation }: Props) {
  const { ticketId, ticketNumber } = route.params;
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);

  const scrollRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyPhoto, setReplyPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTicketAndMessages = useCallback(async () => {
    setError(null);
    const [detailRes, msgRes] = await Promise.all([
      getTicketDetails(ticketId),
      getTicketMessages(ticketId),
    ]);

    setLoading(false);

    if (detailRes.success && detailRes.data) {
      setTicket(detailRes.data);
    } else {
      setError(detailRes.error || 'Failed to load ticket');
    }

    if (msgRes.success && msgRes.data) {
      setMessages(msgRes.data);
    }
  }, [ticketId]);

  useEffect(() => {
    loadTicketAndMessages();
  }, [loadTicketAndMessages]);

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      return;
    }
    setSending(true);

    try {
      let attachmentUrl: string | null = null;
      if (replyPhoto) {
        const uploadRes = await uploadSupportAttachment(replyPhoto, 'reply_issue.jpg');
        if (uploadRes.success && uploadRes.url) {
          attachmentUrl = uploadRes.url;
        }
      }

      const res = await sendTicketMessage({
        ticketId,
        message: replyText.trim(),
        attachmentUrl,
      });

      setSending(false);

      if (res.success) {
        setReplyText('');
        setReplyPhoto(null);
        await loadTicketAndMessages();
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 300);
      } else {
        Alert.alert('Notice', res.error || 'Failed to send reply');
      }
    } catch (err: any) {
      setSending(false);
      Alert.alert('Error', err?.message || 'Failed to send reply');
    }
  };

  const handleCloseTicket = () => {
    Alert.alert(
      'Mark as Closed?',
      'If your issue has been resolved, you can close this ticket. You can still view its history at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Close',
          style: 'default',
          onPress: async () => {
            setClosing(true);
            const res = await closeOwnTicket(ticketId);
            setClosing(false);
            if (res.success) {
              await loadTicketAndMessages();
            } else {
              Alert.alert('Error', res.error || 'Could not close ticket');
            }
          },
        },
      ]
    );
  };

  const isClosed = ticket?.status === 'Closed';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Wave Background */}
          <Image
            source={require('../../../assets/designs/screen-background.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="stretch"
          />

          {/* Top Logo Row */}
          <View style={styles.topLogoRow}>
            <Image
              source={require('../../../assets/designs/shelfsafe-logo.jpg')}
              style={styles.screenLogo}
              resizeMode="contain"
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.ticketNumRow}>
              <Text style={styles.ticketNum}>
                {ticket?.ticket_number || ticketNumber || 'Support Ticket'}
              </Text>
              {ticket && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{ticket.status}</Text>
                </View>
              )}
            </View>
            <Text style={styles.subjectText}>{ticket?.subject || 'Loading...'}</Text>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading details...</Text>
            </View>
          ) : error || !ticket ? (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={COLORS.dangerDark} />
              <Text style={styles.errorText}>{error || 'Ticket not found'}</Text>
            </View>
          ) : (
            <>
              {/* Ticket Details Card */}
              <View style={styles.card}>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Category</Text>
                    <Text style={styles.metaVal}>{ticket.category}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Priority</Text>
                    <Text style={styles.metaVal}>{ticket.priority}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Assigned Staff</Text>
                    <Text style={styles.metaVal}>
                      {ticket.assigned_name || 'Support Queue'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionHeading}>Original Description</Text>
                <Text style={styles.descriptionText}>{ticket.description}</Text>

                {ticket.attachment_url && (
                  <View style={styles.attachmentWrap}>
                    <Text style={styles.attachmentLabel}>Attached Screenshot:</Text>
                    <TouchableOpacity
                      onPress={() => setPreviewImage(ticket.attachment_url)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: ticket.attachment_url }}
                        style={styles.attachmentImage}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {ticket.resolution_notes && (
                  <View style={styles.resolutionBox}>
                    <View style={styles.resolutionHeader}>
                      <CheckCircle2 size={16} color="#15803D" />
                      <Text style={styles.resolutionTitle}>Resolution Notes</Text>
                    </View>
                    <Text style={styles.resolutionText}>
                      {ticket.resolution_notes}
                    </Text>
                  </View>
                )}

                {!isClosed && (
                  <TouchableOpacity
                    style={styles.closeTicketBtn}
                    onPress={handleCloseTicket}
                    disabled={closing}
                  >
                    <Check size={14} color={COLORS.textMuted} />
                    <Text style={styles.closeTicketBtnText}>
                      {closing ? 'Closing...' : 'Mark as Resolved / Close Ticket'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Message Thread */}
              <View style={styles.threadCard}>
                <Text style={styles.threadTitle}>Conversation & Responses</Text>

                {messages.length === 0 ? (
                  <View style={styles.emptyMessages}>
                    <Clock size={20} color={COLORS.textTertiary} />
                    <Text style={styles.emptyMessagesText}>
                      Our support personnel will review your ticket and reply within one business day.
                    </Text>
                  </View>
                ) : (
                  messages.map((msg) => {
                    const isUser = msg.sender_role === 'user';
                    const timeStr = new Date(msg.created_at).toLocaleTimeString(
                      undefined,
                      { hour: '2-digit', minute: '2-digit' }
                    );
                    const dateStr = new Date(msg.created_at).toLocaleDateString(
                      undefined,
                      { month: 'short', day: 'numeric' }
                    );

                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.messageBubble,
                          isUser ? styles.userBubble : styles.supportBubble,
                        ]}
                      >
                        <View style={styles.msgHeader}>
                          <View style={styles.msgSenderRow}>
                            {isUser ? (
                              <User size={13} color={COLORS.textMuted} />
                            ) : (
                              <Headphones size={13} color={COLORS.primary} />
                            )}
                            <Text
                              style={[
                                styles.msgSenderName,
                                !isUser && { color: COLORS.primary },
                              ]}
                            >
                              {isUser ? 'You' : msg.sender_name || 'Support Team'}
                            </Text>
                          </View>
                          <Text style={styles.msgTime}>
                            {dateStr} • {timeStr}
                          </Text>
                        </View>

                        <Text style={styles.msgContent}>{msg.message}</Text>

                        {msg.attachment_url && (
                          <TouchableOpacity
                            onPress={() => setPreviewImage(msg.attachment_url)}
                          >
                            <Image
                              source={{ uri: msg.attachment_url }}
                              style={styles.msgAttachmentImage}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}

                {/* Reply Form (if not closed) */}
                {!isClosed ? (
                  <View style={styles.replyBox}>
                    <Text style={styles.replyTitle}>Send Follow-Up Message</Text>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Type your message here..."
                      placeholderTextColor={COLORS.textTertiary}
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                      numberOfLines={3}
                      editable={!sending}
                    />

                    {replyPhoto && (
                      <View style={styles.replyPhotoWrap}>
                        <Image source={{ uri: replyPhoto }} style={styles.replyPhoto} />
                        <TouchableOpacity
                          style={styles.removeReplyPhotoBtn}
                          onPress={() => setReplyPhoto(null)}
                        >
                          <X size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.replyActionRow}>
                      <TouchableOpacity
                        style={styles.attachMiniBtn}
                        onPress={async () => {
                          const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ['images'],
                            quality: 0.8,
                            base64: true,
                          });
                          if (!result.canceled && result.assets?.[0]) {
                            const asset = result.assets[0];
                            if (asset.base64) {
                              setReplyPhoto(`data:image/jpeg;base64,${asset.base64}`);
                            } else {
                              setReplyPhoto(asset.uri);
                            }
                          }
                        }}
                        disabled={sending}
                      >
                        <ImageIcon size={16} color={COLORS.primary} />
                        <Text style={styles.attachMiniBtnText}>Attach Image</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.sendBtn,
                          (!replyText.trim() || sending) && styles.btnDisabled,
                        ]}
                        onPress={handleSendReply}
                        disabled={!replyText.trim() || sending}
                      >
                        {sending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Send size={14} color="#FFFFFF" />
                            <Text style={styles.sendBtnText}>Send</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.closedNoticeBox}>
                    <Text style={styles.closedNoticeText}>
                      This ticket is marked as Closed. To report a new issue, please submit a new support request.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Full Image Preview Modal */}
          {previewImage && (
            <Modal
              visible={!!previewImage}
              transparent
              animationType="fade"
              onRequestClose={() => setPreviewImage(null)}
            >
              <View style={styles.modalBackdrop}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setPreviewImage(null)}
                >
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Image
                  source={{ uri: previewImage }}
                  style={styles.fullModalImage}
                  resizeMode="contain"
                />
              </View>
            </Modal>
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
  topLogoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 6,
  },
  screenLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  header: {
    marginBottom: 16,
  },
  ticketNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  ticketNum: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.primary,
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: '#B45309',
  },
  subjectText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    lineHeight: 22,
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
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: RADIUS.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.dangerDark,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 19,
  },
  attachmentWrap: {
    marginTop: 12,
  },
  attachmentLabel: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  attachmentImage: {
    width: 140,
    height: 90,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    resizeMode: 'cover',
  },
  resolutionBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 14,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  resolutionTitle: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: '#15803D',
  },
  resolutionText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#166534',
    lineHeight: 17,
  },
  closeTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  closeTicketBtnText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  threadCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  threadTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 14,
  },
  emptyMessages: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyMessagesText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  messageBubble: {
    padding: 12,
    borderRadius: RADIUS.lg,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: COLORS.bgWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  supportBubble: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  msgSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  msgSenderName: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  msgTime: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
  msgContent: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 18,
  },
  msgAttachmentImage: {
    width: 120,
    height: 80,
    borderRadius: 8,
    marginTop: 8,
    resizeMode: 'cover',
  },
  replyBox: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  replyTitle: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 8,
  },
  replyInput: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  replyPhotoWrap: {
    position: 'relative',
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  replyPhoto: {
    width: '100%',
    height: '100%',
  },
  removeReplyPhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  attachMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attachMiniBtnText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  sendBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  closedNoticeBox: {
    backgroundColor: COLORS.bgWarm,
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 10,
  },
  closedNoticeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullModalImage: {
    width: '100%',
    height: '80%',
  },
});
