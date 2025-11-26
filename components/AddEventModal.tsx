import React, { useState } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Platform,
    ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { X, Calendar, Clock, MapPin, AlignLeft } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useApp } from "@/context/AppContext";

interface AddEventModalProps {
    visible: boolean;
    onClose: () => void;
    tripId: string;
}

export default function AddEventModal({
    visible,
    onClose,
    tripId,
}: AddEventModalProps) {
    const { createEvent } = useApp();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 60 * 60 * 1000)); // Default 1 hour later
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!title.trim()) return;

        setLoading(true);
        try {
            await createEvent(
                tripId,
                title,
                startDate.toISOString(),
                description,
                location,
                endDate.toISOString()
            );
            onClose();
            resetForm();
        } catch (error) {
            console.error("Error creating event:", error);
            alert("Failed to create event");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setLocation("");
        setStartDate(new Date());
        setEndDate(new Date(new Date().getTime() + 60 * 60 * 1000));
    };

    const onStartDateChange = (event: any, selectedDate?: Date) => {
        setShowStartDatePicker(Platform.OS === "ios");
        if (selectedDate) {
            const newDate = new Date(selectedDate);
            newDate.setHours(startDate.getHours());
            newDate.setMinutes(startDate.getMinutes());
            setStartDate(newDate);

            // Ensure end date is after start date
            if (newDate > endDate) {
                setEndDate(new Date(newDate.getTime() + 60 * 60 * 1000));
            }
        }
    };

    const onStartTimeChange = (event: any, selectedDate?: Date) => {
        setShowStartTimePicker(Platform.OS === "ios");
        if (selectedDate) {
            const newDate = new Date(startDate);
            newDate.setHours(selectedDate.getHours());
            newDate.setMinutes(selectedDate.getMinutes());
            setStartDate(newDate);

            // Ensure end date is after start date
            if (newDate > endDate) {
                setEndDate(new Date(newDate.getTime() + 60 * 60 * 1000));
            }
        }
    };

    const onEndDateChange = (event: any, selectedDate?: Date) => {
        setShowEndDatePicker(Platform.OS === "ios");
        if (selectedDate) {
            const newDate = new Date(selectedDate);
            newDate.setHours(endDate.getHours());
            newDate.setMinutes(endDate.getMinutes());
            setEndDate(newDate);
        }
    };

    const onEndTimeChange = (event: any, selectedDate?: Date) => {
        setShowEndTimePicker(Platform.OS === "ios");
        if (selectedDate) {
            const newDate = new Date(endDate);
            newDate.setHours(selectedDate.getHours());
            newDate.setMinutes(selectedDate.getMinutes());
            setEndDate(newDate);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>New Event</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="What are we doing?"
                                placeholderTextColor="#666"
                                value={title}
                                onChangeText={setTitle}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.label}>Starts</Text>
                                <TouchableOpacity
                                    style={styles.dateTimeButton}
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Calendar size={16} color="#ccc" />
                                    <Text style={styles.dateTimeText}>{formatDate(startDate)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dateTimeButton, { marginTop: 8 }]}
                                    onPress={() => setShowStartTimePicker(true)}
                                >
                                    <Clock size={16} color="#ccc" />
                                    <Text style={styles.dateTimeText}>{formatTime(startDate)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                <Text style={styles.label}>Ends</Text>
                                <TouchableOpacity
                                    style={styles.dateTimeButton}
                                    onPress={() => setShowEndDatePicker(true)}
                                >
                                    <Calendar size={16} color="#ccc" />
                                    <Text style={styles.dateTimeText}>{formatDate(endDate)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dateTimeButton, { marginTop: 8 }]}
                                    onPress={() => setShowEndTimePicker(true)}
                                >
                                    <Clock size={16} color="#ccc" />
                                    <Text style={styles.dateTimeText}>{formatTime(endDate)}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Location</Text>
                            <View style={styles.inputWrapper}>
                                <MapPin size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.inputWithIcon}
                                    placeholder="Where is it?"
                                    placeholderTextColor="#666"
                                    value={location}
                                    onChangeText={setLocation}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <View style={styles.inputWrapper}>
                                <AlignLeft size={20} color="#666" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.inputWithIcon, styles.textArea]}
                                    placeholder="Any details?"
                                    placeholderTextColor="#666"
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.createButton, !title.trim() && styles.disabledButton]}
                            onPress={handleCreate}
                            disabled={!title.trim() || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.createButtonText}>Create Event</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Date Pickers */}
            {showStartDatePicker && (
                <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onStartDateChange}
                />
            )}
            {showStartTimePicker && (
                <DateTimePicker
                    value={startDate}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onStartTimeChange}
                />
            )}
            {showEndDatePicker && (
                <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onEndDateChange}
                />
            )}
            {showEndTimePicker && (
                <DateTimePicker
                    value={endDate}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onEndTimeChange}
                />
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 20,
    },
    container: {
        width: "100%",
        backgroundColor: "#1a1a1a",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#333",
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#fff",
    },
    closeButton: {
        padding: 4,
    },
    form: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: "row",
        marginBottom: 16,
    },
    label: {
        color: "#ccc",
        marginBottom: 8,
        fontSize: 14,
        fontWeight: "500",
    },
    input: {
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        padding: 12,
        color: "#fff",
        fontSize: 16,
        borderWidth: 1,
        borderColor: "#333",
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#333",
    },
    inputIcon: {
        marginLeft: 12,
    },
    inputWithIcon: {
        flex: 1,
        padding: 12,
        color: "#fff",
        fontSize: 16,
    },
    textArea: {
        height: 80,
        textAlignVertical: "top",
    },
    dateTimeButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2a2a2a",
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#333",
    },
    dateTimeText: {
        color: "#fff",
        marginLeft: 8,
        fontSize: 14,
    },
    createButton: {
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 16,
        alignItems: "center",
        marginTop: 8,
    },
    disabledButton: {
        opacity: 0.5,
    },
    createButtonText: {
        color: "#000",
        fontSize: 16,
        fontWeight: "bold",
    },
});
