import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAlert } from "@/context/AlertContext";
import { Check, ChevronLeft, Camera, Sparkles, X } from "lucide-react-native";
import type { SplitType } from "@/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { processBillImage } from "@/utils/ocr";
import BillScanner from "@/components/BillScanner";
import ItemAssigner from "@/components/ItemAssigner";
import { Modal } from "react-native";
import type { SplitItem } from "@/types";
import * as Haptics from 'expo-haptics';

export default function CreateSplitScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { createSplit, getTripById, getUserById } = useApp();
  const { showAlert } = useAlert();

  const trip = getTripById(tripId);
  const members = (trip?.memberIds.map((id) => getUserById(id)).filter(Boolean) || []) as import("@/types").User[];

  const [splitName, setSplitName] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [taxAmount, setTaxAmount] = useState<string>("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Itemized Split State
  const [items, setItems] = useState<SplitItem[]>([]);
  const [isItemized, setIsItemized] = useState(false);

  const toggleMember = (memberId: string) => {
    Haptics.selectionAsync();
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
    try {
      setIsScanning(true);
      const result = await processBillImage(base64);
      setShowScanner(false);

      if (result) {
        if (result.billAmount) setTotalAmount(result.billAmount.toString());
        if (result.taxAmount) {
          setTaxAmount(result.taxAmount.toString());
          setAdvancedMode(true);
        }
        if (result.totalAmount && !result.billAmount) {
          setTotalAmount(result.totalAmount.toString());
        }

        // Handle Items
        if (result.items && result.items.length > 0) {
          const newItems = result.items.map(item => ({
            ...item,
            assignedTo: [] as string[],
          }));
          setItems(newItems);
          setIsItemized(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showAlert("Receipt Processed", `Found ${newItems.length} items.`);
        } else {
          showAlert("Scan Complete", "No individual items detected, using total amount.");
        }
      }
    } catch (error) {
      setShowScanner(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Error", error instanceof Error ? error.message : "Failed to scan bill");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAssignmentsChange = (updatedItems: SplitItem[]) => {
    setItems(updatedItems);

    // Identify all members involved in assignments
    const involvedMemberIds = new Set<string>();
    updatedItems.forEach(item => {
      item.assignedTo.forEach(id => involvedMemberIds.add(id));
    });

    // Update selected members based on assignments
    const newSelectedMembers = Array.from(new Set([...selectedMembers, ...Array.from(involvedMemberIds)]));
    if (newSelectedMembers.length !== selectedMembers.length) {
      setSelectedMembers(newSelectedMembers);
    }

    // Recalculate custom amounts with penny precision
    const newCustomAmounts: Record<string, string> = {};
    newSelectedMembers.forEach(id => newCustomAmounts[id] = "0.00");

    updatedItems.forEach(item => {
      const splitCount = item.assignedTo.length;
      if (splitCount > 0) {
        const itemAmountCents = Math.round(item.amount * 100);
        const baseShareCents = Math.floor(itemAmountCents / splitCount);
        const remainderCents = itemAmountCents % splitCount;

        item.assignedTo.forEach((userId, index) => {
          let shareCents = baseShareCents;
          if (index < remainderCents) {
            shareCents += 1;
          }
          const currentCents = Math.round(parseFloat(newCustomAmounts[userId] || "0") * 100);
          newCustomAmounts[userId] = ((currentCents + shareCents) / 100).toFixed(2);
        });
      }
    });

    setCustomAmounts(newCustomAmounts);
    setSplitType("custom");

    // Auto-update total amount
    const itemsTotal = updatedItems.reduce((sum, item) => sum + item.amount, 0);
    setTotalAmount(itemsTotal.toFixed(2));
  };

  const handleCreateSplit = () => {
    if (!splitName.trim()) {
      showAlert("Error", "Please enter a split name");
      return;
    }

    const bill = parseFloat(totalAmount);
    const tax = parseFloat(taxAmount) || 0;

    if (isNaN(bill) || bill <= 0) {
      showAlert("Error", "Please enter a valid bill amount");
      return;
    }

    if (selectedMembers.length === 0) {
      showAlert("Error", "Please select at least one member");
      return;
    }

    const finalTotal = bill + tax;
    let memberAmounts: { userId: string; amount: number }[];
    const perPersonTax = tax / selectedMembers.length;

    if (splitType === "equal") {
      const perPersonBill = bill / selectedMembers.length;
      const perPersonTotal = perPersonBill + perPersonTax;
      memberAmounts = selectedMembers.map((userId) => ({
        userId,
        amount: Math.round(perPersonTotal * 100) / 100,
      }));
    } else {
      const computedMemberAmounts = selectedMembers.map((userId) => {
        const customBillShare = parseFloat(customAmounts[userId] || "0");
        return {
          userId,
          billShare: customBillShare,
          amount: Math.round((customBillShare + perPersonTax) * 100) / 100
        };
      });

      const totalCustomBill = computedMemberAmounts.reduce((sum, m) => sum + m.billShare, 0);

      if (Math.abs(totalCustomBill - bill) > 0.1) {
        showAlert("Error", `Custom amounts (₹${totalCustomBill}) must equal Bill Amount (₹${bill})`);
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
        items: isItemized ? items : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert("Success", "Split created successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Error", error instanceof Error ? error.message : "Failed to create split");
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
        colors={["#f8fafc", "#f1f5f9"]}
        style={styles.background}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Modern Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Expense</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* Scan Card */}
            {!isItemized && (
              <TouchableOpacity
                style={styles.scanCard}
                onPress={handleScanBill}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#6366f1', '#4f46e5']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.scanGradient}
                >
                  <View style={styles.scanIconBg}>
                    <Camera size={24} color="#4f46e5" fill="#4f46e5" />
                  </View>
                  <View style={styles.scanContent}>
                    <Text style={styles.scanTitle}>Scan Receipt with AI</Text>
                    <Text style={styles.scanSubtitle}>Auto-extract items & prices</Text>
                  </View>
                  <Sparkles size={20} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', top: 12, right: 12 }} />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Main Form */}
            <View style={styles.formContainer}>
              {/* Split Name Input - Floating Card */}
              <View style={styles.inputCard}>
                <Text style={styles.label}>What's this for?</Text>
                <TextInput
                  style={styles.nameInput}
                  placeholder="e.g. Dinner, Uber, Groceries"
                  placeholderTextColor="#94a3b8"
                  value={splitName}
                  onChangeText={setSplitName}
                />
              </View>

              {/* Amount Input - Hero Card */}
              <View style={styles.amountCard}>
                <View style={styles.amountHeader}>
                  <Text style={styles.label}>Total Amount</Text>
                  {!isItemized && (
                    <TouchableOpacity onPress={() => setAdvancedMode(!advancedMode)}>
                      <Text style={styles.linkText}>
                        {advancedMode ? "Hide Tax" : "+ Add Tax"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {isItemized && (
                    <TouchableOpacity onPress={() => { setIsItemized(false); setItems([]); }} style={styles.clearBadge}>
                      <X size={12} color="#ef4444" />
                      <Text style={styles.clearText}>Clear Items</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.currencyRow}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={[styles.amountInput, isItemized && styles.amountInputDisabled]}
                    placeholder="0.00"
                    placeholderTextColor="#cbd5e1"
                    value={totalAmount}
                    onChangeText={setTotalAmount}
                    keyboardType="decimal-pad"
                    editable={!isItemized}
                  />
                </View>
              </View>

              {advancedMode && (
                <View style={styles.taxCard}>
                  <Text style={styles.label}>Tax / GST</Text>
                  <TextInput
                    style={styles.taxInput}
                    placeholder="0.00"
                    value={taxAmount}
                    onChangeText={setTaxAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {isItemized ? (
                <View style={styles.itemsContainer}>
                  <ItemAssigner
                    items={items}
                    members={members}
                    onAssignmentsChange={handleAssignmentsChange}
                  />
                </View>
              ) : (
                <View style={styles.manualSplitSection}>
                  <Text style={styles.sectionHeader}>Split With</Text>

                  {/* Split Type Selector */}
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, splitType === 'equal' && styles.toggleBtnActive]}
                      onPress={() => { setSplitType('equal'); Haptics.selectionAsync(); }}
                    >
                      <Text style={[styles.toggleText, splitType === 'equal' && styles.toggleTextActive]}>Equally</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, splitType === 'custom' && styles.toggleBtnActive]}
                      onPress={() => { setSplitType('custom'); Haptics.selectionAsync(); }}
                    >
                      <Text style={[styles.toggleText, splitType === 'custom' && styles.toggleTextActive]}>Custom</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.membersList}>
                    {members.map((member) => {
                      const isSelected = selectedMembers.includes(member!.id);
                      return (
                        <View key={member!.id} style={styles.memberRow}>
                          <TouchableOpacity
                            style={styles.memberSelect}
                            onPress={() => toggleMember(member!.id)}
                          >
                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                              {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                            </View>
                            <Text style={[styles.memberName, isSelected && styles.memberNameSelected]}>{member!.name}</Text>
                          </TouchableOpacity>

                          {isSelected && (
                            <View style={styles.splitAmountContainer}>
                              {splitType === 'equal' ? (
                                <Text style={styles.equalAmountText}>
                                  ₹{((parseFloat(totalAmount) || 0) / selectedMembers.length).toFixed(2)}
                                </Text>
                              ) : (
                                <TextInput
                                  style={styles.customAmountInput}
                                  placeholder="0.00"
                                  value={customAmounts[member!.id] || ""}
                                  onChangeText={(v) => updateCustomAmount(member!.id, v)}
                                  keyboardType="decimal-pad"
                                />
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateSplit}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.createGradient}
            >
              <Text style={styles.createButtonText}>Create Expense</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={showScanner} animationType="slide" presentationStyle="fullScreen">
        <BillScanner
          onCapture={handleScannerCapture}
          onClose={() => setShowScanner(false)}
          processing={isScanning}
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
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Scan Card
  scanCard: {
    marginBottom: 24,
    borderRadius: 20,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  scanGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
  },
  scanIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  scanContent: {
    flex: 1,
  },
  scanTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  scanSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  formContainer: {
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Floating Inputs
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0f172a',
    padding: 0,
  },

  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 8,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    padding: 0,
    height: 50,
  },
  amountInputDisabled: {
    color: '#64748b',
  },
  linkText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
  },
  clearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  clearText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },

  taxCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taxInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'right',
    minWidth: 80,
  },

  itemsContainer: {
    height: 500, // Fixed height for receipt view
  },

  // Manual Split
  manualSplitSection: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#fff',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleTextActive: {
    color: '#0f172a',
  },

  membersList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  memberSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  memberName: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  memberNameSelected: {
    color: '#0f172a',
    fontWeight: '600',
  },
  splitAmountContainer: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  equalAmountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  customAmountInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    textAlign: 'right',
    minWidth: 80,
  },

  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  createButton: {
    borderRadius: 16,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createGradient: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: '#64748b',
    fontSize: 16,
  },
});
