import { StyleSheet, View, Text, TouchableOpacity, FlatList, Platform, ActivityIndicator, TextInput, KeyboardAvoidingView, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Users, MapPin, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react-native";
import { useApp } from "@/context/AppContext";
import { LinearGradient } from "expo-linear-gradient";
import type { Trip } from "@/types";
import { useState } from "react";

export default function HomeScreen() {
  const { currentUser, getUserTrips, signUp, login, verifyOtp, resendOtp, isSigningUp, isLoggingIn, isVerifyingOtp, isResendingOtp, signUpError, loginError, verifyOtpError, isLoading } = useApp();
  const userTrips = getUserTrips();
  
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'verify'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  const handleSignUp = async () => {
    try {
      if (!name.trim() || !email.trim() || !password.trim()) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
      
      await signUp(email.trim(), password, name.trim());
      setAuthMode('verify');
      Alert.alert('Success', 'Please check your email for verification code');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to sign up');
    }
  };

  const handleLogin = async () => {
    try {
      if (!email.trim() || !password.trim()) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
      
      await login(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to log in');
    }
  };

  const handleVerifyOtp = async () => {
    try {
      if (!otp.trim()) {
        Alert.alert('Error', 'Please enter the verification code');
        return;
      }
      
      await verifyOtp(email.trim(), otp.trim());
      Alert.alert('Success', 'Email verified successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to verify OTP');
    }
  };

  const handleResendOtp = async () => {
    try {
      await resendOtp(email.trim());
      Alert.alert('Success', 'Verification code sent to your email');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to resend OTP');
    }
  };

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#0f172a", "#1e293b", "#334155"]}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
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
                    <MapPin size={64} color="#10b981" strokeWidth={2.5} />
                    <Text style={styles.appName}>SplitSync</Text>
                    <Text style={styles.tagline}>Track trip expenses with friends</Text>
                  </View>

                  {authMode === 'verify' ? (
                    <View style={styles.formContainer}>
                      <Text style={styles.formTitle}>Verify Your Email</Text>
                      <Text style={styles.formSubtitle}>Enter the 6-digit code sent to {email}</Text>
                      
                      <View style={styles.inputGroup}>
                        <View style={styles.inputWrapper}>
                          <Mail size={20} color="#64748b" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Enter OTP"
                            placeholderTextColor="#64748b"
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
                        activeOpacity={0.8}
                        disabled={isVerifyingOtp}
                      >
                        {isVerifyingOtp ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>Verify Email</Text>
                            <ArrowRight size={20} color="#ffffff" />
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handleResendOtp}
                        activeOpacity={0.8}
                        disabled={isResendingOtp}
                      >
                        {isResendingOtp ? (
                          <ActivityIndicator color="#10b981" />
                        ) : (
                          <Text style={styles.authSecondaryButtonText}>Resend Code</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setAuthMode('login');
                          setOtp('');
                        }}
                        style={styles.linkButton}
                      >
                        <Text style={styles.linkText}>Back to Login</Text>
                      </TouchableOpacity>
                    </View>
                  ) : authMode === 'signup' ? (
                    <View style={styles.formContainer}>
                      <Text style={styles.formTitle}>Create Account</Text>
                      <Text style={styles.formSubtitle}>Join SplitSync to manage your trips</Text>
                      
                      <View style={styles.inputGroup}>
                        <View style={styles.inputWrapper}>
                          <UserIcon size={20} color="#64748b" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            placeholderTextColor="#64748b"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                          />
                        </View>

                        <View style={styles.inputWrapper}>
                          <Mail size={20} color="#64748b" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#64748b"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                        </View>

                        <View style={styles.inputWrapper}>
                          <Lock size={20} color="#64748b" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#64748b"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleSignUp}
                        activeOpacity={0.8}
                        disabled={isSigningUp}
                      >
                        {isSigningUp ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>Sign Up</Text>
                            <ArrowRight size={20} color="#ffffff" />
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setAuthMode('login')}
                        style={styles.linkButton}
                      >
                        <Text style={styles.linkText}>Already have an account? Log In</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.formContainer}>
                      <Text style={styles.formTitle}>Welcome Back</Text>
                      <Text style={styles.formSubtitle}>Log in to access your trips</Text>
                      
                      <View style={styles.inputGroup}>
                        <View style={styles.inputWrapper}>
                          <Mail size={20} color="#64748b" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#64748b"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                        </View>

                        <View style={styles.inputWrapper}>
                          <Lock size={20} color="#64748b" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#64748b"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleLogin}
                        activeOpacity={0.8}
                        disabled={isLoggingIn}
                      >
                        {isLoggingIn ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>Log In</Text>
                            <ArrowRight size={20} color="#ffffff" />
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setAuthMode('signup')}
                        style={styles.linkButton}
                      >
                        <Text style={styles.linkText}>Don&apos;t have an account? Sign Up</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.disclaimer}>
                    By continuing, you agree to our terms of service
                  </Text>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  const renderTripCard = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.tripCard}
      onPress={() => router.push(`/trip/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.tripCardHeader}>
        <MapPin size={24} color="#10b981" strokeWidth={2.5} />
        <Text style={styles.tripName}>{item.name}</Text>
      </View>
      <View style={styles.tripCardFooter}>
        <View style={styles.tripCodeContainer}>
          <Text style={styles.tripCodeLabel}>Join Code:</Text>
          <Text style={styles.tripCode}>{item.joinCode}</Text>
        </View>
        <View style={styles.memberCountContainer}>
          <Users size={16} color="#64748b" />
          <Text style={styles.memberCount}>{item.memberIds.length}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0f172a", "#1e293b", "#334155"]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello, {currentUser?.name?.split(" ")[0] || "User"}!</Text>
              <Text style={styles.subtitle}>Manage your trip expenses</Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimaryButton]}
                onPress={() => router.push("/create-trip")}
                activeOpacity={0.8}
              >
                <Plus size={24} color="#ffffff" strokeWidth={3} />
                <Text style={styles.actionButtonText}>Create Trip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionSecondaryButton]}
                onPress={() => router.push("/join-trip")}
                activeOpacity={0.8}
              >
                <Users size={24} color="#10b981" strokeWidth={2.5} />
                <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Join Trip</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tripsSection}>
              <Text style={styles.sectionTitle}>Your Trips</Text>
              {userTrips.length === 0 ? (
                <View style={styles.emptyState}>
                  <MapPin size={48} color="#475569" />
                  <Text style={styles.emptyStateTitle}>No trips yet</Text>
                  <Text style={styles.emptyStateText}>Create a new trip or join one using a code</Text>
                </View>
              ) : (
                <FlatList
                  data={userTrips}
                  renderItem={renderTripCard}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.tripsList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: "#ffffff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
  },
  content: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
  },
  actionPrimaryButton: {
    backgroundColor: "#10b981",
  },
  actionSecondaryButton: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#10b981",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
  secondaryButtonText: {
    color: "#10b981",
  },
  tripsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#0f172a",
    marginBottom: 16,
  },
  tripsList: {
    gap: 12,
    paddingBottom: 20,
  },
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tripCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  tripName: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#0f172a",
    flex: 1,
  },
  tripCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tripCodeLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  tripCode: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#0f172a",
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
  },
  memberCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  memberCount: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#64748b",
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
    paddingHorizontal: 40,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  authContainer: {
    padding: 24,
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  appName: {
    fontSize: 42,
    fontWeight: "800" as const,
    color: "#ffffff",
    marginTop: 16,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
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
  inputGroup: {
    gap: 16,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    paddingVertical: 16,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    marginBottom: 16,
  },
  authSecondaryButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#10b981",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: "#94a3b8",
    textDecorationLine: "underline" as const,
  },
  disclaimer: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 32,
    textAlign: "center",
  },
});
