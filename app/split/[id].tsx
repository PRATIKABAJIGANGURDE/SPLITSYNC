import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share as RNShare,
  TextInput,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import {
  Receipt,
  CheckCircle,
  Clock,
  XCircle,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Share2,
  Activity,
  Plus,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import PaymentModal from "@/components/PaymentModal";

export default function SplitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getSplitById,
    getUserById,
    markAsPaid,
    approvePayment,
    currentUser,
    generateWhatsAppMessage,
    recordPayment,
    getSplitPayments,
    refreshData,
    rejectPayment,
  } = useApp();

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const split = getSplitById(id);

  const fetchPayments = useCallback(async () => {
    if (id) {
      const data = await getSplitPayments(id);
      setPayments(data);
    }
  }, [id, getSplitPayments]);

  useEffect(() => {
    fetchPayments();

    // Realtime subscription for payments
    const paymentsSubscription = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `split_id=eq.${id}`,
        },
        (payload) => {
          console.log('Realtime payment update:', payload);
          fetchPayments();
          refreshData(); // Refresh global data as well
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsSubscription);
    };
  }, [id, fetchPayments, refreshData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
      await fetchPayments();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshData, fetchPayments]);

  if (!split) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Split not found</Text>
      </View>
    );
  }

  const creator = getUserById(split.creatorId);
  const isCreator = split.creatorId === currentUser?.id;
  const myMember = split.members.find((m) => m.userId === currentUser?.id);

  // Calculate my paid amount from payments table
  const myPaidAmount = payments
    .filter((p) => p.payerId === currentUser?.id && p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);

  const myPendingApprovalAmount = payments
    .filter((p) => p.payerId === currentUser?.id && p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const myPendingAmount = myMember ? myMember.amount - myPaidAmount : 0;

  const handlePay = () => {
    if (myPendingAmount <= 0) {
      Alert.alert("All Paid", "You have already paid your share!");
      return;
    }

    const remainingToPay = myPendingAmount - myPendingApprovalAmount;
    if (remainingToPay <= 0.01) {
      Alert.alert("Pending Approval", "Your payment is waiting for approval.");
      return;
    }

    setAmount(remainingToPay.toString());
    setPaymentModalVisible(true);
  };

  const handlePaymentComplete = async (amount: number, method: 'upi' | 'manual') => {
    try {
      await recordPayment(split.id, amount);
      setPaymentModalVisible(false);
      Alert.alert("Success", "Payment recorded! Waiting for approval.");
      fetchPayments();
    } catch (error) {
      Alert.alert("Error", "Failed to record payment");
    }
  };

  const handleApprove = (userId: string) => {
    const user = getUserById(userId);
    Alert.alert(
      "Approve Payment",
      `Confirm that ${user?.name} has paid their share?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          style: "default",
          onPress: async () => {
            try {
              await approvePayment({ splitId: split.id, userId });
              Alert.alert("Success", `Payment approved for ${user?.name}`);
              fetchPayments();
            } catch (error) {
              Alert.alert("Error", "Failed to approve payment");
            }
          },
        },
      ]
    );
  };

  const handleReject = (userId: string) => {
    const user = getUserById(userId);
    Alert.alert(
      "Reject Payment",
      `Are you sure you want to reject the payment from ${user?.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await rejectPayment({ splitId: split.id, userId });
              Alert.alert("Rejected", `Payment rejected for ${user?.name}`);
              fetchPayments();
            } catch (error) {
              Alert.alert("Error", "Failed to reject payment");
            }
          },
        },
      ]
    );
  };

  const handleSendReminder = async (userId: string) => {
    const message = generateWhatsAppMessage(split, userId);
    try {
      await RNShare.share({ message });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleShare = async () => {
    try {
      await RNShare.share({
        message: `Check out this split: ${split.name}\nTotal: ₹${split.totalAmount}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const renderMemberItem = (member: typeof split.members[0]) => {
    const user = getUserById(member.userId);
    if (!user) return null;

    const isMe = member.userId === currentUser?.id;

    // Calculate paid amount for this member
    const memberPaidAmount = payments
      .filter((p) => p.payerId === member.userId && p.status === "approved")
      .reduce((sum, p) => sum + p.amount, 0);

    const memberPendingApprovalAmount = payments
      .filter((p) => p.payerId === member.userId && p.status === "pending")
      .reduce((sum, p) => sum + p.amount, 0);

    const memberPending = member.amount - memberPaidAmount;

    let statusIcon;
    let statusColor = "#64748b";
    let statusText = "";

    if (memberPending <= 0.01) { // Floating point tolerance
      statusIcon = <CheckCircle size={18} color="#10b981" />;
      statusColor = "#10b981";
      statusText = "Paid";
    } else if (memberPendingApprovalAmount > 0) {
      if (memberPending - memberPendingApprovalAmount <= 0.01) {
        statusIcon = <Clock size={18} color="#f59e0b" />;
        statusColor = "#f59e0b";
        statusText = "Pending Approval";
      } else {
        statusIcon = <Clock size={18} color="#f59e0b" />;
        statusColor = "#f59e0b";
        statusText = `₹${(memberPending - memberPendingApprovalAmount).toFixed(0)} Left`;
      }
    } else if (memberPaidAmount > 0) {
      statusIcon = <Clock size={18} color="#f59e0b" />;
      statusColor = "#f59e0b";
      statusText = `₹${memberPending.toFixed(0)} Left`;
    } else {
      statusIcon = <XCircle size={18} color="#ef4444" />;
      statusColor = "#ef4444";
      statusText = "Unpaid";
    }

    // Override if status is explicitly approved (legacy support)
    if (member.status === "approved") {
      statusIcon = <CheckCircle size={18} color="#10b981" />;
      statusColor = "#10b981";
      statusText = "Paid";
    }

    return (
      <View key={member.userId} style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>{user.name[0].toUpperCase()}</Text>
          </View>
          <View style={styles.memberDetails}>
            <Text style={styles.memberName}>
              {isMe ? "You" : user.name}
            </Text>
            <View style={styles.memberStatus}>
              {statusIcon}
              <Text style={[styles.memberStatusText, { color: statusColor }]}>
                {statusText}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.memberActions}>
          <Text style={styles.memberAmount}>₹{member.amount}</Text>
          {isCreator && !isMe && memberPendingApprovalAmount > 0 && (
            <View style={styles.approvalActions}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleReject(member.userId)}
                activeOpacity={0.7}
              >
                <XCircle size={20} color="#ef4444" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveButton}
                onPress={() => handleApprove(member.userId)}
                activeOpacity={0.7}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}
          {isCreator && !isMe && member.status === "not_paid" && memberPendingApprovalAmount <= 0 && (
            <TouchableOpacity
              style={styles.reminderButton}
              onPress={() => handleSendReminder(member.userId)}
              activeOpacity={0.7}
            >
              <MessageCircle size={16} color="#10b981" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const totalPaid = split.members
    .filter((m) => m.status === "approved")
    .reduce((sum, m) => sum + m.amount, 0);
  const totalPending = split.members
    .filter((m) => m.status !== "approved")
    .reduce((sum, m) => sum + m.amount, 0);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <LinearGradient
          colors={["#10b981", "#059669"]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={["top"]}>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <ChevronLeft size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Split Details</Text>
                <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                  <Share2 size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <View style={styles.splitInfo}>
                <View style={styles.iconCircle}>
                  <Receipt size={40} color="#10b981" strokeWidth={2.5} />
                </View>
                <Text style={styles.splitName}>{split.name}</Text>
                <Text style={styles.splitCreator}>Created by {isCreator ? "You" : creator?.name}</Text>
                <Text style={styles.totalAmount}>₹{split.totalAmount}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconContainer}>
              <CheckCircle size={24} color="#10b981" />
            </View>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={[styles.summaryValue, styles.paidValue]}>₹{totalPaid}</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconContainer, styles.pendingIconContainer]}>
              <Clock size={24} color="#ef4444" />
            </View>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, styles.pendingValue]}>₹{totalPending}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {split.members.map((member) => renderMemberItem(member))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          {(() => {
            const historyEvents = [
              {
                type: "created",
                date: new Date(split.createdAt),
                title: "Split Created",
                description: `${isCreator ? "You" : creator?.name} created this split`,
                icon: <Plus size={16} color="#ffffff" />,
                color: "#3b82f6",
              },
              ...split.members
                .filter((m) => m.markedPaidAt)
                .map((m) => {
                  const u = getUserById(m.userId);
                  const isMe = u?.id === currentUser?.id;
                  return {
                    type: "paid",
                    date: new Date(m.markedPaidAt!),
                    title: "Marked as Paid",
                    description: `${isMe ? "You" : u?.name} marked as paid`,
                    icon: <CheckCircle size={16} color="#ffffff" />,
                    color: "#f59e0b",
                  };
                }),
              ...split.members
                .filter((m) => m.approvedAt)
                .map((m) => {
                  const u = getUserById(m.userId);
                  const isMe = u?.id === currentUser?.id;
                  return {
                    type: "approved",
                    date: new Date(m.approvedAt!),
                    title: "Payment Approved",
                    description: `Payment approved for ${isMe ? "You" : u?.name}`,
                    icon: <CheckCircle size={16} color="#ffffff" />,
                    color: "#10b981",
                  };
                }),
            ].sort((a, b) => b.date.getTime() - a.date.getTime());

            return historyEvents.map((event, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={[styles.historyIcon, { backgroundColor: event.color }]}>
                  {event.icon}
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle}>{event.title}</Text>
                  <Text style={styles.historyDescription}>{event.description}</Text>
                  <Text style={styles.historyDate}>
                    {event.date.toLocaleDateString()} • {event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ));
          })()}
        </View>
      </ScrollView>

      {myMember && myPendingAmount > 0.01 && !isCreator && (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <TouchableOpacity
            style={styles.markPaidButton}
            onPress={handlePay}
            activeOpacity={0.8}
          >
            <CheckCircle size={24} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.markPaidButtonText}>Pay Now</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Payment Modal */}
      {paymentModalVisible && (
        <PaymentModal
          visible={paymentModalVisible}
          onClose={() => setPaymentModalVisible(false)}
          onPaymentComplete={handlePaymentComplete}
          recipientName={creator?.name || "Split Creator"}
          recipientUpiId={creator?.upiId}
          defaultAmount={myPendingAmount - myPendingApprovalAmount}
          note={split.name}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 1,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  splitInfo: {
    alignItems: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  splitName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
  },
  splitCreator: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 16,
  },
  totalAmount: {
    fontSize: 40,
    fontWeight: "700",
    color: "#ffffff",
  },
  content: {
    flex: 1,
  },
  summaryCards: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginTop: -40,
    gap: 16,
    zIndex: 2,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pendingIconContainer: {
    backgroundColor: "#fef2f2",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  paidValue: {
    color: "#10b981",
  },
  pendingValue: {
    color: "#ef4444",
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 32,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
  },
  memberCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#475569",
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  memberStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberStatusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  memberActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  memberAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  approveButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  approveButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  reminderButton: {
    backgroundColor: "#dcfce7",
    padding: 8,
    borderRadius: 8,
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  markPaidButton: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginHorizontal: 24,
    marginVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  markPaidButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 18,
    color: "#64748b",
  },
  historyItem: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  historyDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: "#94a3b8",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0f172a",
    marginRight: 4,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: "700",
    color: "#0f172a",
    minWidth: 100,
    textAlign: "center",
  },
  helperText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 32,
  },
  upiButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upiButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  upiButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  manualButton: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
  },
  manualButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#64748b",
  },
  disabledButton: {
    opacity: 0.7,
  },
  approvalActions: {
    flexDirection: "row",
    gap: 8,
  },
  rejectButton: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
