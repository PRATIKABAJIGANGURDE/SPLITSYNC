import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Linking,
    Alert,
    Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";

interface PaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onPaymentComplete: (amount: number, method: 'upi' | 'manual') => Promise<void>;
    recipientName: string;
    recipientUpiId?: string;
    defaultAmount?: number;
    note?: string;
}

export default function PaymentModal({
    visible,
    onClose,
    onPaymentComplete,
    recipientName,
    recipientUpiId,
    defaultAmount,
    note,
}: PaymentModalProps) {
    const [amount, setAmount] = useState("");
    const [isPaying, setIsPaying] = useState(false);

    useEffect(() => {
        if (visible && defaultAmount) {
            setAmount(defaultAmount.toString());
        } else if (visible) {
            setAmount("");
        }
    }, [visible, defaultAmount]);

    const handleUpiPayment = async () => {
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount");
            return;
        }

        if (!recipientUpiId) {
            Alert.alert(
                "UPI ID Missing",
                `${recipientName} has not set their UPI ID. Please ask them to add it in their profile.`
            );
            return;
        }

        const payAmount = parseFloat(amount);
        const upiUrl = `upi://pay?pa=${recipientUpiId}&pn=${encodeURIComponent(
            recipientName
        )}${note ? `&tn=${encodeURIComponent(note)}` : ''}&am=${payAmount}&cu=INR`;

        try {
            const canOpen = await Linking.canOpenURL(upiUrl);
            if (canOpen) {
                await Linking.openURL(upiUrl);

                // Wait for 6 seconds before asking for confirmation
                setTimeout(() => {
                    Alert.alert(
                        "Payment Confirmation",
                        "Did you complete the payment in the UPI app?",
                        [
                            { text: "No", style: "cancel" },
                            {
                                text: "Yes, Payment Done",
                                onPress: async () => {
                                    setIsPaying(true);
                                    try {
                                        await onPaymentComplete(payAmount, 'upi');
                                        onClose();
                                    } catch (error) {
                                        // Error handling done by parent
                                    } finally {
                                        setIsPaying(false);
                                    }
                                },
                            },
                        ]
                    );
                }, 6000);
            } else {
                Alert.alert(
                    "UPI App Not Found",
                    "We couldn't find a supported UPI app. Do you want to mark this as paid manually?",
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Mark as Paid",
                            onPress: async () => {
                                handleManualPaymentWrapper(payAmount);
                            },
                        },
                    ]
                );
            }
        } catch (error) {
            Alert.alert(
                "Error Opening UPI",
                "Failed to open UPI app. Do you want to mark this as paid manually?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Mark as Paid",
                        onPress: async () => {
                            handleManualPaymentWrapper(payAmount);
                        },
                    },
                ]
            );
        }
    };

    const handleManualPayment = async () => {
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount");
            return;
        }
        handleManualPaymentWrapper(parseFloat(amount));
    };

    const handleManualPaymentWrapper = async (payAmount: number) => {
        setIsPaying(true);
        try {
            await onPaymentComplete(payAmount, 'manual');
            onClose();
        } catch (error) {
            // Error handling done by parent
        } finally {
            setIsPaying(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Make Payment</Text>
                    <Text style={styles.modalSubtitle}>Enter amount to pay {recipientName}</Text>

                    <View style={styles.amountInputContainer}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                            style={styles.amountInput}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                    </View>

                    {defaultAmount && (
                        <Text style={styles.helperText}>
                            Total due: ₹{defaultAmount.toFixed(2)}
                        </Text>
                    )}

                    <TouchableOpacity
                        style={[styles.upiButton, isPaying && styles.disabledButton]}
                        onPress={handleUpiPayment}
                        disabled={isPaying}
                    >
                        <LinearGradient
                            colors={["#2563eb", "#1d4ed8"]}
                            style={styles.upiButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            {isPaying ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Text style={styles.upiButtonText}>Pay with UPI</Text>
                                    <ChevronRight size={20} color="#ffffff" />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.manualButton, isPaying && styles.disabledButton]}
                        onPress={handleManualPayment}
                        disabled={isPaying}
                    >
                        <Text style={styles.manualButtonText}>Mark as Paid (Cash/Other)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onClose}
                        disabled={isPaying}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalContent: {
        backgroundColor: "#ffffff",
        borderRadius: 24,
        padding: 24,
        width: "100%",
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0f172a",
        marginBottom: 8,
        textAlign: "center",
    },
    modalSubtitle: {
        fontSize: 14,
        color: "#64748b",
        marginBottom: 24,
        textAlign: "center",
    },
    amountInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        gap: 8,
    },
    currencySymbol: {
        fontSize: 32,
        fontWeight: "600",
        color: "#0f172a",
    },
    amountInput: {
        fontSize: 40,
        fontWeight: "700",
        color: "#0f172a",
        minWidth: 100,
        textAlign: "center",
    },
    helperText: {
        fontSize: 14,
        color: "#64748b",
        textAlign: "center",
        marginBottom: 24,
    },
    upiButton: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: "hidden",
    },
    upiButtonGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        gap: 8,
    },
    upiButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#ffffff",
    },
    manualButton: {
        backgroundColor: "#f1f5f9",
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 12,
    },
    manualButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#475569",
    },
    cancelButton: {
        paddingVertical: 12,
        alignItems: "center",
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#ef4444",
    },
    disabledButton: {
        opacity: 0.7,
    },
});
