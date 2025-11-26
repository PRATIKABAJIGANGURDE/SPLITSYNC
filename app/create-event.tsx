import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Calendar, Clock, MapPin, ChevronLeft, Calendar as CalendarIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function CreateEventScreen() {
    const { tripId } = useLocalSearchParams<{ tripId: string }>();
    const { createEvent, getTripById } = useApp();

    const trip = getTripById(tripId);

    const [eventTitle, setEventTitle] = useState("");
    const [eventLocation, setEventLocation] = useState("");
    const [eventDescription, setEventDescription] = useState("");
    const [eventStartDate, setEventStartDate] = useState(new Date());
    const [eventStartTime, setEventStartTime] = useState(new Date());
    const [eventEndDate, setEventEndDate] = useState(new Date());
    const [eventEndTime, setEventEndTime] = useState(new Date(new Date().getTime() + 60 * 60 * 1000));
    const [activePicker, setActivePicker] = useState<"start-date" | "start-time" | "end-date" | "end-time" | null>(null);

    const handleCreateEvent = async () => {
        if (!eventTitle.trim()) {
            Alert.alert("Error", "Please enter an event title");
            return;
        }

        const start = new Date(
            eventStartDate.getFullYear(),
            eventStartDate.getMonth(),
            eventStartDate.getDate(),
            eventStartTime.getHours(),
            eventStartTime.getMinutes()
        );

        const end = new Date(
            eventEndDate.getFullYear(),
            eventEndDate.getMonth(),
            eventEndDate.getDate(),
            eventEndTime.getHours(),
            eventEndTime.getMinutes()
        );

        if (end < start) {
            Alert.alert("Error", "End time cannot be before start time");
            return;
        }

        try {
            await createEvent(
                tripId,
                eventTitle.trim(),
                start.toISOString(),
                end.toISOString(),
                eventLocation.trim() || undefined,
                eventDescription.trim() || undefined
            );
            Alert.alert("Success", "Event created successfully!", [
                {
                    text: "OK",
                    onPress: () => router.back(),
                },
            ]);
        } catch (error) {
            Alert.alert("Error", "Failed to create event");
        }
    };

    if (!trip) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Trip not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={["#0f172a", "#1e293b"]}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <SafeAreaView edges={["top", "left", "right"]}>
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={styles.backButton}
                            activeOpacity={0.7}
                        >
                            <ChevronLeft size={24} color="#ffffff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>New Event</Text>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.iconContainer}>
                        <CalendarIcon size={56} color="#10b981" strokeWidth={2} />
                    </View>

                    <Text style={styles.subtitle}>Plan something exciting for your trip</Text>

                    <View style={styles.section}>
                        <Text style={styles.label}>Event Title</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="What are we doing?"
                            placeholderTextColor="#94a3b8"
                            value={eventTitle}
                            onChangeText={setEventTitle}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Starts</Text>
                            <TouchableOpacity
                                style={styles.dateTimeButton}
                                onPress={() => setActivePicker("start-date")}
                            >
                                <Calendar size={18} color="#64748b" />
                                <Text style={styles.dateTimeText}>
                                    {eventStartDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.dateTimeButton, { marginTop: 8 }]}
                                onPress={() => setActivePicker("start-time")}
                            >
                                <Clock size={18} color="#64748b" />
                                <Text style={styles.dateTimeText}>
                                    {eventStartTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Ends</Text>
                            <TouchableOpacity
                                style={styles.dateTimeButton}
                                onPress={() => setActivePicker("end-date")}
                            >
                                <Calendar size={18} color="#64748b" />
                                <Text style={styles.dateTimeText}>
                                    {eventEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.dateTimeButton, { marginTop: 8 }]}
                                onPress={() => setActivePicker("end-time")}
                            >
                                <Clock size={18} color="#64748b" />
                                <Text style={styles.dateTimeText}>
                                    {eventEndTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Location</Text>
                        <View style={styles.inputWrapper}>
                            <MapPin size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { paddingLeft: 44 }]}
                                placeholder="Where is it?"
                                placeholderTextColor="#94a3b8"
                                value={eventLocation}
                                onChangeText={setEventLocation}
                            />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 12 }]}
                            placeholder="Any details?"
                            placeholderTextColor="#94a3b8"
                            value={eventDescription}
                            onChangeText={setEventDescription}
                            multiline
                        />
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <SafeAreaView edges={["bottom"]}>
                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={handleCreateEvent}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.createButtonText}>Create Event</Text>
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>
            </KeyboardAvoidingView>

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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    header: {
        paddingBottom: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        zIndex: 10,
    },
    headerContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingTop: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#ffffff",
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 100, // Extra padding for footer
    },
    iconContainer: {
        alignItems: "center",
        marginBottom: 20,
    },
    subtitle: {
        fontSize: 16,
        color: "#64748b",
        textAlign: "center",
        marginBottom: 32,
    },
    section: {
        marginBottom: 16,
    },
    row: {
        flexDirection: "row",
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748b",
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: "#ffffff",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: "#0f172a",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    dateTimeButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 8,
    },
    dateTimeText: {
        fontSize: 14,
        color: "#0f172a",
        fontWeight: "500",
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        position: "relative",
    },
    inputIcon: {
        position: "absolute",
        left: 14,
        zIndex: 1,
    },
    footer: {
        backgroundColor: "#ffffff",
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
    },
    createButton: {
        backgroundColor: "#10b981",
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        shadowColor: "#10b981",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    createButtonText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#ffffff",
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
});
