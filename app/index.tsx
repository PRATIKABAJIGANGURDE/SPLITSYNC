import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  RefreshControl,
  Dimensions,
  StatusBar,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  Users,
  MapPin,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  LogOut,
  RefreshCw,
  Search,
  Copy,
  Check,
  ChevronRight,
} from "lucide-react-native";
import { useApp } from "@/context/AppContext";
import { LinearGradient } from "expo-linear-gradient";
import type { Trip } from "@/types";
import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const {
    currentUser,
    getUserTrips,
    signUp,
    login,
    verifyOtp,
    resendOtp,
    logout,
    isSigningUp,
    isLoggingIn,
    isLoggingInWithGoogle,
    signInWithGoogle,
    isVerifyingOtp,
    isResendingOtp,
    isLoading,
  } = useApp();
  const userTrips = getUserTrips() || [];
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedTripId, setCopiedTripId] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "signup" | "verify">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const handleSignUp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!name.trim() || !email.trim() || !password.trim()) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }

      await signUp({ email: email.trim(), password, name: name.trim() });
      setAuthMode("verify");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Please check your email for verification code");
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to sign up");
    }
  };

  const handleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!email.trim() || !password.trim()) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }

      await login({ email: email.trim(), password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to log in");
    }
  };

  const handleGoogleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await signInWithGoogle();
      // Success is handled by the redirect and session update
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to sign in with Google");
    }
  };

  const handleVerifyOtp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!otp.trim()) {
        Alert.alert("Error", "Please enter the verification code");
        return;
      }

      await verifyOtp({ email: email.trim(), otp: otp.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Email verified successfully!");
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to verify OTP");
    }
  };

  const handleResendOtp = async () => {
    Haptics.selectionAsync();
    try {
      await resendOtp(email.trim());
      Alert.alert("Success", "Verification code sent to your email");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to resend OTP");
    }
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => {
          logout();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!queryClient) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      await queryClient.invalidateQueries({ queryKey: ["splits"] });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const filteredTrips = useMemo(() => {
    if (!userTrips || userTrips.length === 0) {
      return [];
    }
    if (!searchQuery.trim()) {
      return userTrips;
    }
    return userTrips.filter(
      (trip) =>
        trip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.joinCode.includes(searchQuery)
    );
  }, [userTrips, searchQuery]);

  const handleCopyJoinCode = async (tripId: string, joinCode: string) => {
    Haptics.selectionAsync();
    try {
      if (!tripId || !joinCode) return;
      await Clipboard.setStringAsync(joinCode);
      setCopiedTripId(tripId);
      setTimeout(() => setCopiedTripId(null), 2000);
    } catch (error) {
      console.error("Copy error:", error);
    }
  };

  const renderTripCard = ({ item }: { item: Trip }) => {
    if (!item || !item.id) return null;

    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => {
          Haptics.selectionAsync();
          item.id && router.push(`/trip/${item.id}`);
        }}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={["#ffffff", "#f8fafc"]}
          style={styles.tripCardGradient}
        >
          <View style={styles.tripCardHeader}>
            <View style={styles.tripIconContainer}>
              <MapPin size={24} color="#10b981" fill="#dcfce7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripName}>{item.name || "Unnamed Trip"}</Text>
              <View style={styles.memberCountContainer}>
                <Users size={14} color="#64748b" />
                <Text style={styles.memberCount}>
                  {item.memberIds?.length || 0} Members
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </View>

          <View style={styles.tripCardFooter}>
            <TouchableOpacity
              style={styles.tripCodeContainer}
              onPress={(e) => {
                e.stopPropagation();
                if (item.id && item.joinCode) {
                  handleCopyJoinCode(item.id, item.joinCode);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.tripCodeLabel}>Code:</Text>
              <Text style={styles.tripCode}>{item.joinCode || "N/A"}</Text>
              {copiedTripId === item.id ? (
                <Check size={14} color="#10b981" />
              ) : (
                <Copy size={14} color="#94a3b8" />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={["#0f172a", "#1e293b", "#334155"]}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView
            style={styles.safeArea}
            edges={["top", "left", "right", "bottom"]}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardAvoid}
            >
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.authContainer}>
                  <View style={styles.logoContainer}>
                    <View style={styles.logoIcon}>
                      <MapPin size={48} color="#10b981" fill="#064e3b" />
                    </View>
                    <Text style={styles.appName}>SplitSync</Text>
                    <Text style={styles.tagline}>
                      Track trip expenses with friends
                    </Text>
                  </View>

                  <BlurView intensity={20} tint="light" style={styles.authCard}>
                    {authMode === "verify" ? (
                      <View style={styles.formContainer}>
                        <Text style={styles.formTitle}>Verify Email</Text>
                        <Text style={styles.formSubtitle}>
                          Enter code sent to {email}
                        </Text>

                        <View style={styles.inputGroup}>
                          <View style={styles.inputWrapper}>
                            <TextInput
                              style={styles.input}
                              placeholder="000000"
                              placeholderTextColor="rgba(255,255,255,0.5)"
                              value={otp}
                              onChangeText={setOtp}
                              keyboardType="number-pad"
                              maxLength={6}
                              autoCapitalize="none"
                            />
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={handleVerifyOtp}
                          disabled={isVerifyingOtp}
                        >
                          <LinearGradient
                            colors={["#10b981", "#059669"]}
                            style={styles.primaryButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            {isVerifyingOtp ? (
                              <ActivityIndicator color="#ffffff" />
                            ) : (
                              <Text style={styles.primaryButtonText}>
                                Verify
                              </Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={handleResendOtp}
                          disabled={isResendingOtp}
                          style={{ marginTop: 16 }}
                        >
                          <Text style={styles.linkText}>Resend Code</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.formContainer}>
                        <Text style={styles.formTitle}>
                          {authMode === "login" ? "Welcome Back" : "Create Account"}
                        </Text>
                        <Text style={styles.formSubtitle}>
                          {authMode === "login"
                            ? "Log in to continue"
                            : "Sign up to get started"}
                        </Text>

                        {authMode === "signup" && (
                          <View style={styles.inputWrapper}>
                            <UserIcon size={20} color="rgba(255,255,255,0.7)" />
                            <TextInput
                              style={styles.input}
                              placeholder="Full Name"
                              placeholderTextColor="rgba(255,255,255,0.5)"
                              value={name}
                              onChangeText={setName}
                              autoCapitalize="words"
                            />
                          </View>
                        )}

                        <View style={styles.inputWrapper}>
                          <Mail size={20} color="rgba(255,255,255,0.7)" />
                          <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                        </View>

                        <View style={styles.inputWrapper}>
                          <Lock size={20} color="rgba(255,255,255,0.7)" />
                          <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                          />
                        </View>

                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={
                            authMode === "login" ? handleLogin : handleSignUp
                          }
                          disabled={isLoggingIn || isSigningUp}
                        >
                          <LinearGradient
                            colors={["#10b981", "#059669"]}
                            style={styles.primaryButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            {isLoggingIn || isSigningUp ? (
                              <ActivityIndicator color="#ffffff" />
                            ) : (
                              <Text style={styles.primaryButtonText}>
                                {authMode === "login" ? "Log In" : "Sign Up"}
                              </Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>

                        {authMode === "login" && (
                          <TouchableOpacity
                            style={[styles.primaryButton, { marginTop: 12, backgroundColor: "#ffffff" }]}
                            onPress={handleGoogleLogin}
                            disabled={isLoggingInWithGoogle}
                          >
                            <View style={[styles.primaryButtonGradient, { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0" }]}>
                              {isLoggingInWithGoogle ? (
                                <ActivityIndicator color="#0f172a" />
                              ) : (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                  <Text style={[styles.primaryButtonText, { color: "#0f172a" }]}>
                                    Sign in with Google
                                  </Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          onPress={() =>
                            setAuthMode(
                              authMode === "login" ? "signup" : "login"
                            )
                          }
                          style={styles.switchAuthButton}
                        >
                          <Text style={styles.linkText}>
                            {authMode === "login"
                              ? "Don't have an account? Sign Up"
                              : "Already have an account? Log In"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </BlurView>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#0f172a", "#1e293b"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={["top", "left", "right"]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>
                Hello, {currentUser?.name?.split(" ")[0]}
              </Text>
              <Text style={styles.subtitle}>Your Trips</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("/profile");
                }}
              >
                <UserIcon size={20} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleLogout}
              >
                <LogOut size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchBarContainer}>
            <Search size={20} color="#64748b" />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search trips..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <View style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>×</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.contentContainer}>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/create-trip");
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#10b981", "#059669"]}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Plus size={24} color="#ffffff" />
              <Text style={styles.actionText}>New Trip</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/join-trip");
            }}
            activeOpacity={0.8}
          >
            <View style={styles.secondaryAction}>
              <Users size={24} color="#10b981" />
              <Text style={[styles.actionText, { color: "#10b981" }]}>
                Join Trip
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredTrips}
          renderItem={renderTripCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.tripsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#10b981"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MapPin size={48} color="#cbd5e1" />
              <Text style={styles.emptyStateTitle}>No trips found</Text>
              <Text style={styles.emptyStateText}>
                Create a new trip or join one to get started.
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  searchBarInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#0f172a",
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: -2,
  },
  contentContainer: {
    flex: 1,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  quickActions: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    backgroundColor: "#ffffff",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  tripsList: {
    paddingBottom: 100,
    gap: 16,
  },
  tripCard: {
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    backgroundColor: "#ffffff",
  },
  tripCardGradient: {
    borderRadius: 20,
    padding: 16,
  },
  tripCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  tripIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  tripName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  memberCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberCount: {
    fontSize: 14,
    color: "#64748b",
  },
  tripCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  tripCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  tripCodeLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  tripCode: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#475569",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  authContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  appName: {
    fontSize: 42,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 8,
  },
  authCard: {
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  formContainer: {
    padding: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  formSubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginBottom: 32,
    textAlign: "center",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    marginLeft: 12,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  switchAuthButton: {
    marginTop: 24,
    alignItems: "center",
  },
  linkText: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "600",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
});
