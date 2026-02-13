import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo, useEffect } from "react";
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
  Map as MapIcon,
  Wallet,
  Calendar,
  Trash2,
  MapPin,
  Activity,
} from "lucide-react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { Split, TripEvent, ActivityItem } from "@/types";
import * as Clipboard from "expo-clipboard";

import LiveMap from "@/components/LiveMap";
import PaymentModal from "@/components/PaymentModal";

type ViewMode = "planning" | "expense" | "map";
type ExpenseTab = "splits" | "members" | "summary" | "activity";

export default function TripDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getTripById,
    getTripSplits,
    getUserById,
    currentUser,
    getTripEvents,
    createEvent,
    deleteEvent,
    deleteTrip,
    getTripActivity,
    recordPayment,
    refreshData,
  } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>("expense");
  const [expenseTab, setExpenseTab] = useState<ExpenseTab>("splits");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [settleParams, setSettleParams] = useState<{
    visible: boolean;
    recipientId: string;
    recipientName: string;
    recipientUpi?: string;
    amount: number;
    splitIds: string[];
  }>({
    visible: false,
    recipientId: '',
    recipientName: '',
    amount: 0,
    splitIds: [],
  });

  useEffect(() => {
    if (expenseTab === "activity" && id) {
      getTripActivity(id).then(setActivity);
    }
  }, [expenseTab, id, getTripActivity]);

  const trip = getTripById(id);
  const splits = getTripSplits(id);
  const events = getTripEvents(id);

  const sortedEvents = useMemo(() => {
    return events.filter((e) => {
      const eventDate = new Date(e.startTime);
      return (
        eventDate.getDate() === selectedDate.getDate() &&
        eventDate.getMonth() === selectedDate.getMonth() &&
        eventDate.getFullYear() === selectedDate.getFullYear()
      );
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, selectedDate]);

  // Get unique dates from events for the itinerary calendar strip
  const eventDates = useMemo(() => {
    const dates = events.map((e) => {
      const d = new Date(e.startTime);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    });
    return [...new Set(dates)].sort((a, b) => a - b).map((t) => new Date(t));
  }, [events]);

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

  const handleDeleteTrip = () => {
    Alert.alert("Delete Trip", "Are you sure you want to delete this trip? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTrip(trip.id);
            router.replace("/");
          } catch (error) {
            Alert.alert("Error", "Failed to delete trip");
          }
        },
      },
    ]);
  };

  const handleDeleteEvent = (eventId: string) => {
    Alert.alert("Delete Event", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(eventId);
          } catch (error) {
            Alert.alert("Error", "Failed to delete event");
          }
        },
      },
    ]);
  };

  const calculateBalances = () => {
    // Map of userId -> amount (positive means you owe them, negative means they owe you)
    const balances: Record<string, number> = {};
    const details: {
      userId: string;
      amount: number;
      splitIds: string[];
    }[] = [];

    splits.forEach((split) => {
      // If I am the creator, check who owes me
      if (split.creatorId === currentUser?.id) {
        split.members.forEach((member) => {
          if (member.userId !== currentUser?.id && member.status !== "approved") {
            // They owe me
            balances[member.userId] = (balances[member.userId] || 0) - member.amount;
          }
        });
      } else {
        // If someone else created it, check if I owe them
        const myMember = split.members.find((m) => m.userId === currentUser?.id);
        if (myMember && (myMember.status === "not_paid" || myMember.status === "pending_approval")) {
          // I owe them.
          // Note: We include pending_approval here because technically it's not "settled" until approved,
          // but for "Pay All", we might only want to pay what is NOT paid.
          // Let's filter for 'not_paid' for the Settle Up action, but show total pending including approvals for view.
          const amount = myMember.amount;
          balances[split.creatorId] = (balances[split.creatorId] || 0) + amount;

          if (myMember.status === "not_paid") {
            const existingDetail = details.find(d => d.userId === split.creatorId);
            if (existingDetail) {
              existingDetail.amount += amount;
              existingDetail.splitIds.push(split.id);
            } else {
              details.push({
                userId: split.creatorId,
                amount: amount,
                splitIds: [split.id]
              });
            }
          }
        }
      }
    });

    // Format for UI
    const owedByYou = Object.entries(balances)
      .filter(([_, amount]) => amount > 0)
      .map(([userId, amount]) => ({ userId, amount }));

    const owedToYou = Object.entries(balances)
      .filter(([_, amount]) => amount < 0)
      .map(([userId, amount]) => ({ userId, amount: Math.abs(amount) }));

    return { owedByYou, owedToYou, payableDetails: details };
  };

  const balances = calculateBalances();

  const handleSettleUp = (userId: string) => {
    const detail = balances.payableDetails.find(d => d.userId === userId);
    if (!detail || detail.amount <= 0) {
      Alert.alert("Nothing to Pay", "You don't have any unpaid splits with this person.");
      return;
    }

    const user = getUserById(userId);
    setSettleParams({
      visible: true,
      recipientId: userId,
      recipientName: user?.name || "Member",
      recipientUpi: user?.upiId,
      amount: detail.amount,
      splitIds: detail.splitIds,
    });
  };

  const onSettlePaymentComplete = async (amount: number, method: 'upi' | 'manual') => {
    try {
      // Record payment for EACH split
      // Distribute the total amount proportionally or just mark them paid?
      // Since we calculated the exact total of specific splits, we should loop and pay them.
      // However, recordPayment doesn't take 'splitIds'. It takes 'splitId'.
      // Implementation: We will call recordPayment for each split.

      let paidCount = 0;
      for (const splitId of settleParams.splitIds) {
        const split = splits.find(s => s.id === splitId);
        const myMember = split?.members.find(m => m.userId === currentUser?.id);
        if (split && myMember) {
          await recordPayment(split.id, myMember.amount);
          paidCount++;
        }
      }

      setSettleParams(prev => ({ ...prev, visible: false }));
      Alert.alert("Success", `Recorded payments for ${paidCount} splits! Waiting for approval.`);
      await refreshData();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to record some payments. Please try again.");
    }
  };

  function timeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
  }

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "split_created": return "rgba(16, 185, 129, 0.1)";
      case "event_created": return "rgba(59, 130, 246, 0.1)";
      case "member_joined": return "rgba(245, 158, 11, 0.1)";
      case "trip_created": return "rgba(139, 92, 246, 0.1)";
      case "payment_approved": return "rgba(16, 185, 129, 0.1)";
      case "payment_recorded": return "rgba(245, 158, 11, 0.1)";
      default: return "#f1f5f9";
    }
  };

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "split_created": return <Receipt size={20} color="#10b981" />;
      case "event_created": return <Calendar size={20} color="#3b82f6" />;
      case "member_joined": return <Users size={20} color="#f59e0b" />;
      case "trip_created": return <MapIcon size={20} color="#8b5cf6" />;
      case "payment_approved": return <CheckCircle size={20} color="#10b981" />;
      case "payment_recorded": return <Clock size={20} color="#f59e0b" />;
      default: return <Activity size={20} color="#64748b" />;
    }
  };

  const renderSplitCard = (split: Split) => {
    const creator = getUserById(split.creatorId);
    const myMember = split.members.find((m) => m.userId === currentUser?.id);
    const isCreator = split.creatorId === currentUser?.id;

    let statusIcon;
    let statusColor: string = "#64748b";
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
            <View style={styles.splitIconContainer}>
              <Receipt size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.splitName}>{split.name}</Text>
              <Text style={styles.splitCreator}>
                Created by {isCreator ? "You" : creator?.name}
              </Text>
            </View>
          </View>
          <Text style={styles.splitAmount}>₹{split.totalAmount}</Text>
        </View>

        {myMember && (
          <View style={styles.splitCardFooter}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
              {statusIcon}
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusText} • ₹{myMember.amount}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Delete Split", "Are you sure?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => { } } // TODO: Implement delete split from here if needed
                ])
              }}
              style={styles.deleteButton}
            >
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderActivityView = () => {
    if (activity.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Activity size={48} color="#cbd5e1" />
          <Text style={styles.emptyStateText}>No activity yet</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {activity.map((item) => (
          <View key={item.id} style={styles.activityItem}>
            <View style={[styles.activityIcon, { backgroundColor: getActivityColor(item.type) }]}>
              {getActivityIcon(item.type)}
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>
                <Text style={{ fontWeight: "700" }}>{item.user?.name || "Unknown"}</Text> {item.title}
              </Text>
              <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
            </View>
            <View style={styles.activityMeta}>
              <Text style={styles.activityTime}>{timeAgo(item.timestamp)}</Text>
              {item.amount && (
                <Text style={styles.activityAmount}>₹{item.amount.toFixed(2)}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderExpenseView = () => (
    <View style={styles.content}>
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          <TouchableOpacity
            style={[styles.chip, expenseTab === "splits" && styles.chipActive]}
            onPress={() => setExpenseTab("splits")}
          >
            <Receipt size={16} color={expenseTab === "splits" ? "#ffffff" : "#64748b"} />
            <Text style={[styles.chipText, expenseTab === "splits" && styles.chipTextActive]}>
              Splits
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, expenseTab === "members" && styles.chipActive]}
            onPress={() => setExpenseTab("members")}
          >
            <Users size={16} color={expenseTab === "members" ? "#ffffff" : "#64748b"} />
            <Text style={[styles.chipText, expenseTab === "members" && styles.chipTextActive]}>
              Members
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, expenseTab === "summary" && styles.chipActive]}
            onPress={() => setExpenseTab("summary")}
          >
            <BarChart3 size={16} color={expenseTab === "summary" ? "#ffffff" : "#64748b"} />
            <Text style={[styles.chipText, expenseTab === "summary" && styles.chipTextActive]}>
              Balances
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, expenseTab === "activity" && styles.chipActive]}
            onPress={() => setExpenseTab("activity")}
          >
            <Activity size={16} color={expenseTab === "activity" ? "#ffffff" : "#64748b"} />
            <Text style={[styles.chipText, expenseTab === "activity" && styles.chipTextActive]}>
              Activity
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {expenseTab === "splits" ? (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {splits.length === 0 ? (
            <View style={styles.emptyState}>
              <Receipt size={48} color="#cbd5e1" />
              <Text style={styles.emptyStateTitle}>No splits yet</Text>
              <Text style={styles.emptyStateText}>Create your first split to start tracking</Text>
            </View>
          ) : (
            splits.map((split) => renderSplitCard(split))
          )}
        </ScrollView>
      ) : expenseTab === "members" ? (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
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
      ) : expenseTab === "summary" ? (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {balances.owedByYou.length === 0 && balances.owedToYou.length === 0 ? (
            <View style={styles.emptyState}>
              <CheckCircle size={48} color="#10b981" />
              <Text style={styles.emptyStateTitle}>All Settled Up!</Text>
              <Text style={styles.emptyStateText}>You don't owe anyone, and no one owes you.</Text>
            </View>
          ) : (
            <>
              {balances.owedByYou.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>You Owe</Text>
                  {balances.owedByYou.map((item) => {
                    const user = getUserById(item.userId);
                    return (
                      <View key={item.userId} style={styles.balanceCard}>
                        <View style={styles.memberInfo}>
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarText}>{user?.name?.[0] || "?"}</Text>
                          </View>
                          <View>
                            <Text style={styles.memberName}>{user?.name}</Text>
                            <Text style={[styles.balanceAmount, { color: '#ef4444' }]}>
                              ₹{item.amount.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.payAllButton}
                          onPress={() => handleSettleUp(item.userId)}
                        >
                          <Text style={styles.payAllButtonText}>Pay All</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {balances.owedToYou.length > 0 && (
                <View style={[styles.section, { marginTop: 12 }]}>
                  <Text style={styles.sectionTitle}>Owed to You</Text>
                  {balances.owedToYou.map((item) => {
                    const user = getUserById(item.userId);
                    return (
                      <View key={item.userId} style={styles.balanceCard}>
                        <View style={styles.memberInfo}>
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarText}>{user?.name?.[0] || "?"}</Text>
                          </View>
                          <View>
                            <Text style={styles.memberName}>{user?.name}</Text>
                            <Text style={[styles.balanceAmount, { color: '#10b981' }]}>
                              ₹{item.amount.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                        {/* We could add a 'Remind All' button here later */}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        renderActivityView()
      )}
    </View>
  );

  const renderPlanningView = () => {
    return (
      <View style={styles.content}>
        {eventDates.length > 0 && (
          <View style={styles.calendarStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarScroll}>
              {eventDates.map((date, index) => {
                const isSelected =
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();

                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.dateCard, isSelected && styles.dateCardActive]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dateTextActive]}>
                      Day {index + 1}
                    </Text>
                    <Text style={[styles.dateText, isSelected && styles.dateTextActive]}>
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {sortedEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <MapIcon size={64} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={styles.emptyStateTitle}>No events yet</Text>
              <Text style={styles.emptyStateText}>Plan your trip by adding events</Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push(`/create-event?tripId=${trip.id}`)}
              >
                <Text style={styles.emptyStateButtonText}>Add First Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedEvents.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventTimeContainer}>
                  <Text style={styles.eventTime}>
                    {new Date(event.startTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineDot} />
                </View>
                <View style={styles.eventContent}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.location && (
                      <View style={styles.eventLocation}>
                        <MapPin size={14} color="#64748b" />
                        <Text style={styles.eventLocationText}>{event.location}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteEvent(event.id)} style={styles.deleteEventButton}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

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
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ChevronRight size={24} color="#ffffff" style={{ transform: [{ rotate: "180deg" }] }} />
              </TouchableOpacity>
              <Text style={styles.tripName}>{trip.name}</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleShareCode} style={styles.iconButton}>
                  <Share2 size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteTrip} style={styles.iconButton}>
                  <Trash2 size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.joinCodeContainer}>
              <Text style={styles.joinCodeLabel}>Join Code:</Text>
              <View style={styles.codeBox}>
                <Text style={styles.joinCode}>{trip.joinCode}</Text>
                <TouchableOpacity onPress={handleCopyCode}>
                  <Copy size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {viewMode === "expense" ? (
        renderExpenseView()
      ) : viewMode === "planning" ? (
        renderPlanningView()
      ) : (
        <LiveMap trip={trip} currentUserId={currentUser?.id || ""} />
      )}

      <View style={styles.bottomNavContainer}>
        <BlurView intensity={30} tint="dark" style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setViewMode("planning")}
          >
            <View style={[styles.navIconWrapper, viewMode === "planning" && styles.navIconActive]}>
              <Calendar size={28} color={viewMode === "planning" ? "#ffffff" : "#94a3b8"} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setViewMode("map")}
          >
            <View style={[styles.navIconWrapper, viewMode === "map" && styles.navIconActive]}>
              <MapIcon size={28} color={viewMode === "map" ? "#ffffff" : "#94a3b8"} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabContainer}
            onPress={() => {
              if (viewMode === "expense") {
                router.push(`/create-split?tripId=${trip.id}`);
              } else {
                router.push(`/create-event?tripId=${trip.id}`);
              }
            }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#10b981", "#059669"]}
              style={styles.fab}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Plus size={32} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setViewMode("expense")}
          >
            <View style={[styles.navIconWrapper, viewMode === "expense" && styles.navIconActive]}>
              <Wallet size={28} color={viewMode === "expense" ? "#ffffff" : "#94a3b8"} />
            </View>
          </TouchableOpacity>
        </BlurView>
      </View>
      <PaymentModal
        visible={settleParams.visible}
        onClose={() => setSettleParams(prev => ({ ...prev, visible: false }))}
        onPaymentComplete={onSettlePaymentComplete}
        recipientName={settleParams.recipientName}
        recipientUpiId={settleParams.recipientUpi}
        defaultAmount={settleParams.amount}
        note={`Settle Up (${settleParams.splitIds.length} splits)`}
      />
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
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  tripName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
  },
  joinCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  joinCodeLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  joinCode: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  chipsContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  chipsScroll: {
    gap: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  splitCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  splitCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  splitCardTitleRow: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  splitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  splitName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  splitCreator: {
    fontSize: 12,
    color: "#64748b",
  },
  splitAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  splitCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  deleteButton: {
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
  },
  memberCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  memberEmail: {
    fontSize: 12,
    color: "#64748b",
  },
  adminBadge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10b981",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: "600",
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
    backgroundColor: "#f1f5f9",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  bottomNavContainer: {
    position: "absolute",
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
    zIndex: 100,
  },
  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
    overflow: "hidden",
    backgroundColor: "rgba(15, 23, 42, 0.8)", // Fallback/Tint
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  navItem: {
    padding: 4,
  },
  navIconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  navIconActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 26,
  },
  fabContainer: {
    marginTop: 0,
    marginHorizontal: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  calendarStrip: {
    marginBottom: 16,
  },
  calendarScroll: {
    paddingHorizontal: 24,
    gap: 12,
  },
  dateCard: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    minWidth: 70,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateCardActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  dayText: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  dateTextActive: {
    color: "#ffffff",
  },
  eventCard: {
    flexDirection: "row",
    marginBottom: 24,
  },
  eventTimeContainer: {
    width: 60,
    alignItems: "center",
  },
  eventTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#e2e8f0",
    borderRadius: 1,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
    position: "absolute",
    top: 24,
    left: 25,
    borderWidth: 2,
    borderColor: "#f8fafc",
  },
  eventContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    marginLeft: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  eventLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  eventLocationText: {
    fontSize: 12,
    color: "#64748b",
  },
  deleteEventButton: {
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    marginLeft: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  errorText: {
    fontSize: 18,
    color: "#64748b",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  activityMeta: {
    alignItems: "flex-end",
  },
  activityTime: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  balanceCard: {
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
  balanceAmount: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  payAllButton: {
    backgroundColor: "#10b981",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  payAllButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
  },
  section: {
    marginBottom: 24,
  },
});
