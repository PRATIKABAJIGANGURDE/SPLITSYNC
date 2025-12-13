import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Users, Loader, ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

export default function JoinTripScreen() {
  const { joinTrip } = useApp();
  const [joinCode, setJoinCode] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const handleJoinTrip = async () => {
    if (!joinCode.trim() || joinCode.trim().length !== 10) {
      Alert.alert("Error", "Please enter a valid 10-digit join code");
      return;
    }

    setIsJoining(true);
    try {
      const trip = await joinTrip(joinCode.trim());
      if (!trip) {
        Alert.alert("Error", "Invalid join code. Please check and try again.");
        setIsJoining(false);
        return;
      }

      Alert.alert(
        "Joined Successfully!",
        `You've joined "${trip.name}"`,
        [
          {
            text: "View Trip",
            onPress: () => router.replace(`/trip/${trip.id}`),
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to join trip");
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
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
            <Text style={styles.headerTitle}>Join Trip</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <Users size={64} color="#10b981" strokeWidth={2} />
          </View>

          <Text style={styles.subtitle}>
            Enter the 10-digit code shared by your friend
          </Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Join Code</Text>
            <TextInput
              style={styles.input}
              placeholder="1234567890"
              placeholderTextColor="#94a3b8"
              value={joinCode}
              onChangeText={setJoinCode}
              autoFocus
              editable={!isJoining}
              returnKeyType="done"
              onSubmitEditing={handleJoinTrip}
              keyboardType="number-pad"
              maxLength={10}
            />
            <Text style={styles.hint}>Ask your friend for the 10-digit join code</Text>
          </View>

          <TouchableOpacity
            style={[styles.joinButton, isJoining && styles.joinButtonDisabled]}
            onPress={handleJoinTrip}
            disabled={isJoining}
            activeOpacity={0.8}
          >
            {isJoining ? (
              <Loader size={24} color="#ffffff" />
            ) : (
              <Text style={styles.joinButtonText}>Join Trip</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={isJoining}
            activeOpacity={0.6}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
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
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  formContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 20,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    textAlign: "center",
    letterSpacing: 2,
  },
  hint: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  joinButton: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
});
