import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo } from "react";
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
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Split, TripEvent } from "@/types";
import * as Clipboard from "expo-clipboard";
import DateTimePicker from "@react-native-community/datetimepicker";

type ViewMode = "planning" | "expense";
type ExpenseTab = "splits" | "members" | "summary";

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
  } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>("expense");
  const [expenseTab, setExpenseTab] = useState<ExpenseTab>("splits");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  // Event Form State
  const [eventTitle, setEventTitle] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStartDate, setEventStartDate] = useState(new Date());
  const [eventStartTime, setEventStartTime] = useState(new Date());
  const [eventEndDate, setEventEndDate] = useState(new Date());
  const [eventEndTime, setEventEndTime] = useState(new Date());

  const [activePicker, setActivePicker] = useState<"start-date" | "start-time" | "end-date" | "end-time" | null>(null);

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

  const handleAddEvent = async () => {
    if (!eventTitle.trim()) {
      Alert.alert("Error", "Please enter an event title");
      return;
    }

    try {
      // Combine dates and times
      const startDateTime = new Date(eventStartDate);
      startDateTime.setHours(eventStartTime.getHours());
      startDateTime.setMinutes(eventStartTime.getMinutes());

      const endDateTime = new Date(eventEndDate);
      endDateTime.setHours(eventEndTime.getHours());
      endDateTime.setMinutes(eventEndTime.getMinutes());

      if (endDateTime < startDateTime) {
        Alert.alert("Error", "End time cannot be before start time");
        return;
      }

      await createEvent(
        trip.id,
        eventTitle.trim(),
        startDateTime.toISOString(),
        endDateTime.toISOString(),
        eventLocation.trim() || undefined,
        eventDescription.trim() || undefined
      );

      setIsAddingEvent(false);
      // Reset form
      setEventTitle("");
      setEventLocation("");
      setEventDescription("");
      const now = new Date();
      setEventStartDate(now);
      setEventStartTime(now);
      setEventEndDate(now);
      setEventEndTime(now);

      // Select the date of the newly created event
      setSelectedDate(startDateTime);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create event");
    }
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

  const renderExpenseView = () => (
    <View style={styles.content}>
      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <TouchableOpacity
            style={[styles.chip, expenseTab === "splits" && styles.chipActive]}
            onPress={() => setExpenseTab("splits")}
          >
            <Receipt size={16} color={expenseTab === "splits" ? "#ffffff" : "#64748b"} />
            <Text style={[styles.chipText, expenseTab === "splits" && styles.chipTextActive]}>Splits</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, expenseTab === "members" && styles.chipActive]}
            onPress={() => setExpenseTab("members")}
          >
            <Users size={16} color={expenseTab === "members" ? "#ffffff" : "#64748b"} />
            <Text style={[styles.chipText, expenseTab === "members" && styles.chipTextActive]}>Members</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, expenseTab === "summary" && styles.chipActive]}
            onPress={() => setExpenseTab("summary")}
          >
            <BarChart3 size={16} color={expenseTab === "summary" ? "#ffffff" : "#64748b"} />
            <Text style={[styles.chipText, expenseTab === "summary" && styles.chipTextActive]}>Summary</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {expenseTab === "splits" && (
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
      )}

      {expenseTab === "members" && (
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
      )}

      {expenseTab === "summary" && (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
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
          </View>
        </ScrollView>
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
                onPress={() => setIsAddingEvent(true)}
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

      {viewMode === "expense" ? renderExpenseView() : renderPlanningView()}

      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setViewMode("planning")}
          >
            <View style={[styles.navIconWrapper, viewMode === "planning" && styles.navIconActive]}>
              <MapIcon size={30} color={viewMode === "planning" ? "#ffffff" : "#64748b"} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabContainer}
            onPress={() => {
              if (viewMode === "expense") {
                router.push(`/create-split?tripId=${trip.id}`);
              } else {
                setIsAddingEvent(true);
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
              <Wallet size={30} color={viewMode === "expense" ? "#ffffff" : "#64748b"} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isAddingEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddingEvent(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <TouchableOpacity onPress={() => setIsAddingEvent(false)}>
                <XCircle size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="What are we doing?"
                  placeholderTextColor="#64748b"
                  value={eventTitle}
                  onChangeText={setEventTitle}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Starts</Text>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setActivePicker("start-date")}
                  >
                    <Calendar size={16} color="#94a3b8" />
                    <Text style={styles.dateTimeText}>
                      {eventStartDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { marginTop: 8 }]}
                    onPress={() => setActivePicker("start-time")}
                  >
                    <Clock size={16} color="#94a3b8" />
                    <Text style={styles.dateTimeText}>
                      {eventStartTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Ends</Text>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setActivePicker("end-date")}
                  >
                    <Calendar size={16} color="#94a3b8" />
                    <Text style={styles.dateTimeText}>
                      {eventEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { marginTop: 8 }]}
                    onPress={() => setActivePicker("end-time")}
                  >
                    <Clock size={16} color="#94a3b8" />
                    <Text style={styles.dateTimeText}>
                      {eventEndTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Location</Text>
                <View style={styles.inputWrapper}>
                  <MapPin size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { paddingLeft: 40 }]}
                    placeholder="Where is it?"
                    placeholderTextColor="#64748b"
                    value={eventLocation}
                    onChangeText={setEventLocation}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                  placeholder="Any details?"
                  placeholderTextColor="#64748b"
                  value={eventDescription}
                  onChangeText={setEventDescription}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={styles.createEventButton}
                onPress={handleAddEvent}
              >
                <Text style={styles.createEventButtonText}>Create Event</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        {activePicker && (
          <DateTimePicker
            value={
              activePicker === "start-date" ? eventStartDate :
                activePicker === "start-time" ? eventStartTime :
                  activePicker === "end-date" ? eventEndDate :
                    eventEndTime
            }
            mode={activePicker.includes("date") ? "date" : "time"}
            is24Hour={false}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              const currentPicker = activePicker;
              setActivePicker(null);
              if (selectedDate) {
                if (currentPicker === "start-date") setEventStartDate(selectedDate);
                if (currentPicker === "start-time") setEventStartTime(selectedDate);
                if (currentPicker === "end-date") setEventEndDate(selectedDate);
                if (currentPicker === "end-time") setEventEndTime(selectedDate);
              }
            }}
          />
        )}
      </Modal>
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
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  summaryOwed: {
    color: "#ef4444",
  },
  summaryOwedToYou: {
    color: "#10b981",
  },
  calendarStrip: {
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 16,
  },
  calendarScroll: {
    paddingHorizontal: 24,
    gap: 12,
  },
  dateCard: {
    width: 64,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 18,
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
    width: 80,
    alignItems: "center",
  },
  eventTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#e2e8f0",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
    position: "absolute",
    top: 24,
    right: -5,
  },
  eventContent: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    fontSize: 14,
    color: "#64748b",
  },
  deleteEventButton: {
    padding: 8,
  },
  bottomNavContainer: {
    position: "absolute",
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 36,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    padding: 0,
  },
  navIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  navIconActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  fabContainer: {
    marginTop: -4,
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
    shadowRadius: 12,
    elevation: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#475569",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
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
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 18,
    color: "#64748b",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#ffffff",
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  createEventButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 24,
  },
  createEventButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
});
