import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { User, Save, CreditCard, ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

export default function ProfileScreen() {
    const { currentUser, updateProfile, isLoading } = useApp();
    const [name, setName] = useState(currentUser?.name || "");
    const [upiId, setUpiId] = useState(currentUser?.upiId || "");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!name.trim()) {
            Alert.alert("Error", "Name cannot be empty");
            return;
        }

        setIsSaving(true);
        try {
            await updateProfile(name.trim(), upiId.trim());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Profile updated successfully", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Failed to update profile");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <LinearGradient
                colors={["#0f172a", "#1e293b"]}
                style={styles.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <SafeAreaView edges={["top", "left", "right"]}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.back();
                            }}
                            style={styles.backButton}
                        >
                            <ChevronLeft size={28} color="#ffffff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Edit Profile</Text>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoid}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {name?.[0]?.toUpperCase() || "?"}
                            </Text>
                        </View>
                        <Text style={styles.emailText}>{currentUser?.email}</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <View style={styles.inputWrapper}>
                                <User size={20} color="#64748b" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Enter your name"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>UPI ID (for receiving payments)</Text>
                            <View style={styles.inputWrapper}>
                                <CreditCard
                                    size={20}
                                    color="#64748b"
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    value={upiId}
                                    onChangeText={setUpiId}
                                    placeholder="e.g. username@upi"
                                    placeholderTextColor="#94a3b8"
                                    autoCapitalize="none"
                                />
                            </View>
                            <Text style={styles.helperText}>
                                This will be shared with friends so they can pay you directly.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                            disabled={isSaving || isLoading}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={["#10b981", "#059669"]}
                                style={styles.saveButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Save size={20} color="#ffffff" />
                                        <Text style={styles.saveButtonText}>Save Changes</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    headerGradient: {
        paddingBottom: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        zIndex: 10,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#ffffff",
    },
    keyboardAvoid: {
        flex: 1,
    },
    content: {
        padding: 24,
        paddingTop: 40,
    },
    avatarContainer: {
        alignItems: "center",
        marginBottom: 40,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 4,
        borderColor: "#f1f5f9",
    },
    avatarText: {
        fontSize: 40,
        fontWeight: "700",
        color: "#10b981",
    },
    emailText: {
        fontSize: 16,
        color: "#64748b",
    },
    form: {
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 16,
        fontWeight: "600",
        color: "#0f172a",
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "#0f172a",
    },
    helperText: {
        fontSize: 14,
        color: "#64748b",
        marginTop: 4,
    },
    saveButton: {
        marginTop: 16,
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#10b981",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    saveButtonGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 18,
        gap: 8,
    },
    saveButtonText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#ffffff",
    },
});
