import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share as RNShare,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import {
  Receipt,
  CheckCircle,
  Clock,
  XCircle,
  MessageCircle,
} from "lucide-react-native";

export default function SplitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getSplitById, getUserById, markAsPaid, approvePayment, currentUser, generateWhatsAppMessage } =
    useApp();

  const split = getSplitById(id);

  if (!split) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Split not found</Text>
      </View>
    );
  }

  const creator = getUserById(split.creatorId);
  const isCreator = split.creatorId === currentUser?.id;

  const handleMarkAsPaid = () => {
    Alert.alert(
      "Mark as Paid",
      "Have you completed the payment? This will notify the split creator for approval.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Paid",
          onPress: () => {
            markAsPaid(split.id);
            Alert.alert("Success", "Payment marked as paid! Waiting for approval.");
          },
        },
      ]
    );
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
          onPress: () => {
            approvePayment(split.id, userId);
            Alert.alert("Success", `Payment approved for ${user?.name}`);
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

  const myMember = split.members.find((m) => m.userId === currentUser?.id);

  const renderMemberItem = (member: typeof split.members[0]) => {
    const user = getUserById(member.userId);
    if (!user) return null;

    const isMe = member.userId === currentUser?.id;
    let statusIcon;
    let statusColor = "#64748b" as const;
    let statusText = "";
    let actionButton;

    switch (member.status) {
      case "approved":
        statusIcon = <CheckCircle size={24} color="#10b981" />;
        statusColor = "#10b981";
        statusText = "Paid";
        break;
      case "pending_approval":
        statusIcon = <Clock size={24} color="#f59e0b" />;
        statusColor = "#f59e0b";
        statusText = "Pending Approval";
        if (isCreator && !isMe) {
          actionButton = (
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => handleApprove(member.userId)}
              activeOpacity={0.7}
            >
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
          );
        }
        break;
      case "not_paid":
        statusIcon = <XCircle size={24} color="#ef4444" />;
        statusColor = "#ef4444";
        statusText = "Not Paid";
        if (isCreator && !isMe) {
          actionButton = (
            <TouchableOpacity
              style={styles.reminderButton}
              onPress={() => handleSendReminder(member.userId)}
              activeOpacity={0.7}
            >
              <MessageCircle size={16} color="#10b981" />
            </TouchableOpacity>
          );
        }
        break;
    }

    return (
      <View key={member.userId} style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>{user.name[0]}</Text>
          </View>
          <View style={styles.memberDetails}>
            <Text style={styles.memberName}>
              {isMe ? "You" : user.name}
              {isMe && !isCreator && <Text style={styles.youBadge}> (You)</Text>}
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
          <View>{actionButton}</View>
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
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Receipt size={48} color="#10b981" />
          </View>
          <Text style={styles.splitName}>{split.name}</Text>
          <Text style={styles.splitCreator}>Created by {isCreator ? "You" : creator?.name}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={styles.summaryValue}>₹{split.totalAmount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={[styles.summaryValue, styles.paidValue]}>₹{totalPaid}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Pending</Text>
            <Text style={[styles.summaryValue, styles.pendingValue]}>₹{totalPending}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Split Type</Text>
            <Text style={styles.summaryValue}>
              {split.type === "equal" ? "Equal" : "Custom"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Status</Text>
          {split.members.map((member) => renderMemberItem(member))}
        </View>
      </ScrollView>

      {myMember && myMember.status === "not_paid" && !isCreator && (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <TouchableOpacity
            style={styles.markPaidButton}
            onPress={handleMarkAsPaid}
            activeOpacity={0.8}
          >
            <CheckCircle size={24} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.markPaidButtonText}>Mark as Paid</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {isCreator && (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorInfoText}>
              You are the split creator. Approve payments once received.
            </Text>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: "#ffffff",
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  iconContainer: {
    marginBottom: 16,
  },
  splitName: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 8,
  },
  splitCreator: {
    fontSize: 16,
    color: "#64748b",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#0f172a",
  },
  paidValue: {
    color: "#10b981",
  },
  pendingValue: {
    color: "#ef4444",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
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
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#0f172a",
    marginBottom: 4,
  },
  youBadge: {
    fontSize: 14,
    color: "#10b981",
  },
  memberStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberStatusText: {
    fontSize: 14,
    fontWeight: "500" as const,
  },
  memberActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  memberAmount: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#0f172a",
  },
  approveButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
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
  },
  markPaidButtonText: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
  creatorInfo: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  creatorInfoText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
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
});
