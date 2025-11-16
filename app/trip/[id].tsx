import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  Receipt,
  Users,
  Plus,
  ChevronRight,
  Copy,
  Share2,
  BarChart3,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Split } from "@/types";
import * as Clipboard from "expo-clipboard";

export default function TripDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTripById, getTripSplits, getUserById, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<"splits" | "members" | "summary">("splits");

  const trip = getTripById(id);
  const splits = getTripSplits(id);

  if (!trip) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  const members = trip.memberIds.map((memberId) => getUserById(memberId)).filter(Boolean);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(trip.joinCode);
    Alert.alert("Copied!", "Join code copied to clipboard");
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join my trip "${trip.name}"!\n\nUse this code in SplitSync: ${trip.joinCode}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const calculateSummary = () => {
    let totalOwed = 0;
    let totalOwedToYou = 0;
    let pendingApprovals = 0;

    splits.forEach((split) => {
      const myMember = split.members.find((m) => m.userId === currentUser?.id);
      if (myMember) {
        if (myMember.status === "not_paid") {
          totalOwed += myMember.amount;
        } else if (myMember.status === "pending_approval") {
          pendingApprovals++;
        }
      }

      if (split.creatorId === currentUser?.id) {
        split.members.forEach((member) => {
          if (member.userId !== currentUser?.id && member.status !== "approved") {
            totalOwedToYou += member.amount;
          }
        });
      }
    });

    return { totalOwed, totalOwedToYou, pendingApprovals };
  };

  const summary = calculateSummary();

  const renderSplitCard = (split: Split) => {
    const creator = getUserById(split.creatorId);
    const myMember = split.members.find((m) => m.userId === currentUser?.id);
    const isCreator = split.creatorId === currentUser?.id;

    let statusIcon;
    let statusColor = "#64748b" as const;
    let statusText = "Unknown";

    if (myMember) {
      switch (myMember.status) {
        case "approved":
          statusIcon = <CheckCircle size={20} color="#10b981" />;
          statusColor = "#10b981";
          statusText = "Paid";
          break;
        case "pending_approval":
          statusIcon = <Clock size={20} color="#f59e0b" />;
          statusColor = "#f59e0b";
          statusText = "Pending";
          break;
        case "not_paid":
          statusIcon = <XCircle size={20} color="#ef4444" />;
          statusColor = "#ef4444";
          statusText = "Not Paid";
          break;
      }
    }

    return (
      <TouchableOpacity
        key={split.id}
        style={styles.splitCard}
        onPress={() => router.push(`/split/${split.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.splitCardHeader}>
          <View style={styles.splitCardTitleRow}>
            <Receipt size={20} color="#10b981" />
            <Text style={styles.splitName}>{split.name}</Text>
          </View>
          <Text style={styles.splitAmount}>₹{split.totalAmount}</Text>
        </View>

        <View style={styles.splitCardBody}>
          <Text style={styles.splitCreator}>
            Created by {isCreator ? "You" : creator?.name}
          </Text>
          {myMember && (
            <View style={styles.splitStatus}>
              <View>{statusIcon}</View>
              <Text style={[styles.splitStatusText, { color: statusColor }]}>
                {statusText} • ₹{myMember.amount}
              </Text>
            </View>
          )}
        </View>

        <ChevronRight size={20} color="#94a3b8" style={styles.splitCardChevron} />
      </TouchableOpacity>
    );
  };

  const renderSplits = () => (
    <View style={styles.tabContent}>
      {splits.length === 0 ? (
        <View style={styles.emptyState}>
          <Receipt size={48} color="#cbd5e1" />
          <Text style={styles.emptyStateTitle}>No splits yet</Text>
          <Text style={styles.emptyStateText}>Create your first split to start tracking</Text>
        </View>
      ) : (
        <ScrollView style={styles.splitsList} showsVerticalScrollIndicator={false}>
          {splits.map((split) => renderSplitCard(split))}
        </ScrollView>
      )}
    </View>
  );

  const renderMembers = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {members.map((member) => (
        <View key={member!.id} style={styles.memberCard}>
          <View style={styles.memberInfo}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{member!.name[0]}</Text>
            </View>
            <View>
              <Text style={styles.memberName}>{member!.name}</Text>
              <Text style={styles.memberEmail}>{member!.email}</Text>
            </View>
          </View>
          {member!.id === trip.adminId && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderSummary = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Splits</Text>
          <Text style={styles.summaryValue}>{splits.length}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>You Owe</Text>
          <Text style={[styles.summaryValue, styles.summaryOwed]}>₹{summary.totalOwed}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Owed to You</Text>
          <Text style={[styles.summaryValue, styles.summaryOwedToYou]}>
            ₹{summary.totalOwedToYou}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pending Approvals</Text>
          <Text style={styles.summaryValue}>{summary.pendingApprovals}</Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0f172a", "#1e293b"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerContent}>
            <Text style={styles.tripName}>{trip.name}</Text>
            <View style={styles.joinCodeContainer}>
              <Text style={styles.joinCodeLabel}>Code: {trip.joinCode}</Text>
              <TouchableOpacity onPress={handleCopyCode} style={styles.iconButton}>
                <Copy size={18} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShareCode} style={styles.iconButton}>
                <Share2 size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "splits" && styles.tabActive]}
          onPress={() => setActiveTab("splits")}
        >
          <Receipt size={20} color={activeTab === "splits" ? "#10b981" : "#64748b"} />
          <Text style={[styles.tabText, activeTab === "splits" && styles.tabTextActive]}>
            Splits
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "members" && styles.tabActive]}
          onPress={() => setActiveTab("members")}
        >
          <Users size={20} color={activeTab === "members" ? "#10b981" : "#64748b"} />
          <Text style={[styles.tabText, activeTab === "members" && styles.tabTextActive]}>
            Members
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "summary" && styles.tabActive]}
          onPress={() => setActiveTab("summary")}
        >
          <BarChart3 size={20} color={activeTab === "summary" ? "#10b981" : "#64748b"} />
          <Text style={[styles.tabText, activeTab === "summary" && styles.tabTextActive]}>
            Summary
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === "splits" && renderSplits()}
        {activeTab === "members" && renderMembers()}
        {activeTab === "summary" && renderSummary()}
      </View>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <TouchableOpacity
          style={styles.createSplitButton}
          onPress={() => router.push(`/create-split?tripId=${trip.id}`)}
          activeOpacity={0.8}
        >
          <Plus size={24} color="#ffffff" strokeWidth={3} />
          <Text style={styles.createSplitButtonText}>Create Split</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingBottom: 24,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  tripName: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: "#ffffff",
    marginBottom: 12,
  },
  joinCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  joinCodeLabel: {
    fontSize: 16,
    color: "#94a3b8",
    fontFamily: "monospace",
  },
  iconButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#10b981",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#64748b",
  },
  tabTextActive: {
    color: "#10b981",
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  splitsList: {
    flex: 1,
  },
  splitCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  splitCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  splitCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  splitName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#0f172a",
    flex: 1,
  },
  splitAmount: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#0f172a",
  },
  splitCardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  splitCreator: {
    fontSize: 14,
    color: "#64748b",
  },
  splitStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  splitStatusText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  splitCardChevron: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -10,
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
  memberName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#0f172a",
  },
  memberEmail: {
    fontSize: 14,
    color: "#64748b",
  },
  adminBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#0f172a",
  },
  summaryOwed: {
    color: "#ef4444",
  },
  summaryOwedToYou: {
    color: "#10b981",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: "#475569",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  createSplitButton: {
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
  createSplitButtonText: {
    fontSize: 18,
    fontWeight: "600" as const,
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
});
