import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { MapPin, Loader } from "lucide-react-native";

export default function CreateTripScreen() {
  const { createTrip } = useApp();
  const [tripName, setTripName] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handleCreateTrip = async () => {
    if (!tripName.trim()) {
      Alert.alert("Error", "Please enter a trip name");
      return;
    }

    setIsCreating(true);
    try {
      const trip = createTrip(tripName.trim());
      Alert.alert(
        "Trip Created!",
        `Your trip "${trip.name}" has been created.\n\nJoin Code: ${trip.joinCode}\n\nShare this code with your friends!`,
        [
          {
            text: "OK",
            onPress: () => router.replace(`/trip/${trip.id}`),
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create trip");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MapPin size={64} color="#10b981" strokeWidth={2} />
        </View>

        <Text style={styles.title}>Create New Trip</Text>
        <Text style={styles.subtitle}>Start tracking expenses for your group adventure</Text>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Trip Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Goa Trip 2024"
            placeholderTextColor="#94a3b8"
            value={tripName}
            onChangeText={setTripName}
            autoFocus
            editable={!isCreating}
            returnKeyType="done"
            onSubmitEditing={handleCreateTrip}
          />
        </View>

        <TouchableOpacity
          style={[styles.createButton, isCreating && styles.createButtonDisabled]}
          onPress={handleCreateTrip}
          disabled={isCreating}
          activeOpacity={0.8}
        >
          {isCreating ? (
            <Loader size={24} color="#ffffff" />
          ) : (
            <Text style={styles.createButtonText}>Create Trip</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isCreating}
          activeOpacity={0.6}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 40,
  },
  formContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#0f172a",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#0f172a",
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  createButton: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#64748b",
  },
});
