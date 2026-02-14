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
import { Receipt, Check, ChevronLeft, Camera, ScanLine } from "lucide-react-native";
import type { SplitType } from "@/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { processBillImage } from "@/utils/ocr";
import BillScanner from "@/components/BillScanner";
import { Modal } from "react-native";

export default function CreateSplitScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { createSplit, getTripById, getUserById } = useApp();

  const trip = getTripById(tripId);
  const members = trip?.memberIds.map((id) => getUserById(id)).filter(Boolean) || [];

  const [splitName, setSplitName] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [taxAmount, setTaxAmount] = useState<string>("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== memberId));
      const newCustomAmounts = { ...customAmounts };
      delete newCustomAmounts[memberId];
      setCustomAmounts(newCustomAmounts);
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
  };

  const updateCustomAmount = (memberId: string, amount: string) => {
    setCustomAmounts({ ...customAmounts, [memberId]: amount });
  };

  const handleScanBill = () => {
    setShowScanner(true);
  };

  const handleScannerCapture = async (base64: string) => {
    setShowScanner(false);
    try {
      setIsScanning(true);
      // Small delay to allow modal to close smoothly before potentially heavy processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await processBillImage(base64);
      if (result) {
        if (result.billAmount) setTotalAmount(result.billAmount.toString());
        if (result.taxAmount) {
          setTaxAmount(result.taxAmount.toString());
          setAdvancedMode(true);
        }
        if (result.totalAmount && !result.billAmount) {
          setTotalAmount(result.totalAmount.toString());
        }
        Alert.alert("Scanned!", "Bill details extracted successfully.");
      }
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to scan bill");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreateSplit = () => {
    if (!splitName.trim()) {
      Alert.alert("Error", "Please enter a split name");
      return;
    }

    const bill = parseFloat(totalAmount);
    const tax = parseFloat(taxAmount) || 0;

    if (isNaN(bill) || bill <= 0) {
      Alert.alert("Error", "Please enter a valid bill amount");
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert("Error", "Please select at least one member");
      return;
    }

    const finalTotal = bill + tax;
    let memberAmounts: { userId: string; amount: number }[];

    // Calculate Tax Split (Always Equal)
    const perPersonTax = tax / selectedMembers.length;

    if (splitType === "equal") {
      const perPersonBill = bill / selectedMembers.length;
      const perPersonTotal = perPersonBill + perPersonTax;

      memberAmounts = selectedMembers.map((userId) => ({
        userId,
        amount: Math.round(perPersonTotal * 100) / 100,
      }));
    } else {
      // Custom Split for Bill Amount
      const computedMemberAmounts = selectedMembers.map((userId) => {
        const customBillShare = parseFloat(customAmounts[userId] || "0");
        return {
          userId,
          billShare: customBillShare,
          amount: Math.round((customBillShare + perPersonTax) * 100) / 100
        };
      });

      const totalCustomBill = computedMemberAmounts.reduce((sum, m) => sum + m.billShare, 0);

      // Allow small float error
      if (Math.abs(totalCustomBill - bill) > 0.1) {
        Alert.alert(
          "Error",
          `Custom amounts (₹${totalCustomBill}) must equal Bill Amount (₹${bill})`
        );
        return;
      }

      memberAmounts = computedMemberAmounts.map(({ userId, amount }) => ({ userId, amount }));
    }

    try {
      createSplit({
        tripId,
        name: splitName.trim(),
        totalAmount: finalTotal,
        billAmount: bill,
        taxAmount: tax,
        type: splitType,
        members: memberAmounts,
      });
      Alert.alert("Success", "Split created successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create split");
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
            <Text style={styles.headerTitle}>Create Split</Text>
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
            <Receipt size={56} color="#10b981" strokeWidth={2} />
            <TouchableOpacity onPress={handleScanBill} style={styles.scanButton}>
              <Camera size={20} color="#fff" />
              <Text style={styles.scanButtonText}>Scan Bill</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Split expenses with your trip members</Text>

          <View style={styles.section}>
            <Text style={styles.label}>Split Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dinner at Restaurant"
              placeholderTextColor="#94a3b8"
              value={splitName}
              onChangeText={setSplitName}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Bill Amount (₹)</Text>
              <TouchableOpacity onPress={() => setAdvancedMode(!advancedMode)}>
                <Text style={styles.linkText}>
                  {advancedMode ? "Simple Mode" : "Add Tax / Advanced"}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="decimal-pad"
            />
          </View>

          {advancedMode && (
            <View style={styles.section}>
              <Text style={styles.label}>Tax / GST Amount (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                value={taxAmount}
                onChangeText={setTaxAmount}
                keyboardType="decimal-pad"
              />
              <Text style={styles.helperText}>
                Tax is always split equally. Total: ₹{((parseFloat(totalAmount) || 0) + (parseFloat(taxAmount) || 0)).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Split Type</Text>
            <View style={styles.splitTypeContainer}>
              <TouchableOpacity
                style={[styles.splitTypeButton, splitType === "equal" && styles.splitTypeButtonActive]}
                onPress={() => setSplitType("equal")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.splitTypeButtonText,
                    splitType === "equal" && styles.splitTypeButtonTextActive,
                  ]}
                >
                  Equal Split
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.splitTypeButton,
                  splitType === "custom" && styles.splitTypeButtonActive,
                ]}
                onPress={() => setSplitType("custom")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.splitTypeButtonText,
                    splitType === "custom" && styles.splitTypeButtonTextActive,
                  ]}
                >
                  Custom Split
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Select Members ({selectedMembers.length})</Text>
            {members.map((member) => {
              const isSelected = selectedMembers.includes(member!.id);
              const equalAmount = parseFloat(totalAmount) / selectedMembers.length;

              return (
                <View key={member!.id} style={styles.memberItem}>
                  <TouchableOpacity
                    style={styles.memberCheckbox}
                    onPress={() => toggleMember(member!.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Check size={16} color="#ffffff" strokeWidth={3} />}
                    </View>
                    <Text style={styles.memberName}>{member!.name}</Text>
                  </TouchableOpacity>

                  {isSelected && splitType === "custom" && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <TextInput
                        style={styles.customAmountInput}
                        placeholder="₹0.00"
                        placeholderTextColor="#94a3b8"
                        value={customAmounts[member!.id] || ""}
                        onChangeText={(amount) => updateCustomAmount(member!.id, amount)}
                        keyboardType="decimal-pad"
                      />
                      {advancedMode && (parseFloat(taxAmount) > 0) && (
                        <Text style={styles.taxShareText}>+ ₹{(parseFloat(taxAmount) / selectedMembers.length).toFixed(2)} tax</Text>
                      )}
                    </View>
                  )}

                  {isSelected && splitType === "equal" && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.equalAmount}>
                        ₹{isNaN(equalAmount) ? "0.00" : (equalAmount + ((parseFloat(taxAmount) || 0) / selectedMembers.length)).toFixed(2)}
                      </Text>
                      {advancedMode && (parseFloat(taxAmount) > 0) && (
                        <Text style={styles.taxShareText}>incl. tax</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateSplit}
            activeOpacity={0.8}
          >
            <Text style={styles.createButtonText}>Create Split</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={showScanner} animationType="slide" presentationStyle="fullScreen">
        <BillScanner
          onCapture={handleScannerCapture}
          onClose={() => setShowScanner(false)}
        />
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
    paddingTop: 20,
    paddingBottom: 40,
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
    marginBottom: 24,
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
    paddingVertical: 14,
    fontSize: 16,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  splitTypeContainer: {
    flexDirection: "row",
    gap: 12,
  },
  splitTypeButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  splitTypeButtonActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  splitTypeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  splitTypeButtonTextActive: {
    color: "#ffffff",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  memberCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  memberName: {
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "500",
  },
  customAmountInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: "#0f172a",
    minWidth: 100,
    textAlign: "right",
  },
  equalAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10b981",
  },
  createButton: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
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
  scanButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkText: {
    color: "#3b82f6",
    fontWeight: "600",
    fontSize: 14,
  },
  helperText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 6,
  },
  taxShareText: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
});
