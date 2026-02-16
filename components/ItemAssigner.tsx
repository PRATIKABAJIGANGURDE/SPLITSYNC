import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Dimensions } from 'react-native';
import { Check, User as UserIcon, Sparkles, Scissors } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SplitItem, User } from '@/types';
import * as Haptics from 'expo-haptics';

interface ItemAssignerProps {
    items: SplitItem[];
    members: User[];
    onAssignmentsChange: (items: SplitItem[]) => void;
}

const { width } = Dimensions.get('window');

export default function ItemAssigner({ items, members, onAssignmentsChange }: ItemAssignerProps) {
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

    const handleToggleAssignment = (memberId: string) => {
        if (selectedItemIndex === null) return;
        Haptics.selectionAsync();

        const newItems = [...items];
        const item = newItems[selectedItemIndex];

        if (item.assignedTo.includes(memberId)) {
            item.assignedTo = item.assignedTo.filter(id => id !== memberId);
        } else {
            item.assignedTo = [...item.assignedTo, memberId];
        }

        onAssignmentsChange(newItems);
    };

    const currentItem = selectedItemIndex !== null ? items[selectedItemIndex] : null;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={styles.receiptHeader}>
                    <Text style={styles.receiptLogo}>RECEIPT</Text>
                    <Text style={styles.receiptDate}>{new Date().toLocaleDateString()}</Text>
                </View>
                <Sparkles size={16} color="#94a3b8" />
            </View>

            <View style={styles.paperContainer}>
                {/* Receipt Zigzag Top */}
                <View style={styles.zigzagTop} />

                <ScrollView
                    style={styles.itemsList}
                    contentContainerStyle={styles.itemsListContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.dashedLine} />

                    {items.map((item, index) => {
                        const isSelected = selectedItemIndex === index;
                        const assignedNames = item.assignedTo
                            .map(id => members.find(m => m.id === id)?.name.split(' ')[0])
                            .join(', ');

                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setSelectedItemIndex(index);
                                }}
                                activeOpacity={0.9}
                                style={[
                                    styles.receiptRow,
                                    isSelected && styles.receiptRowSelected,
                                    item.assignedTo.length > 0 && !isSelected && styles.receiptRowAssigned
                                ]}
                            >
                                <View style={styles.rowContent}>
                                    <View style={styles.itemMain}>
                                        <Text style={[styles.itemText, isSelected && styles.itemTextSelected]} numberOfLines={1}>
                                            {item.name.toUpperCase()}
                                        </Text>
                                        {assignedNames && (
                                            <Text style={styles.assignedToText} numberOfLines={1}>
                                                ↳ {assignedNames}
                                            </Text>
                                        )}
                                    </View>

                                    <Text style={[styles.priceText, isSelected && styles.itemTextSelected]}>
                                        {item.amount.toFixed(2)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}

                    <View style={styles.dashedLine} />
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>TOTAL</Text>
                        <Text style={styles.totalAmount}>
                            {items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.barcodePlaceholder} />
                    <Text style={styles.thankYouText}>THANK YOU FOR VISITING</Text>
                </ScrollView>

                {/* Receipt Zigzag Bottom - Simulated */}
            </View>

            {/* Floating Member Selection Rail */}
            <View style={[styles.membersRail, !currentItem && styles.membersRailDisabled]}>
                <View style={styles.railHeader}>
                    <Text style={styles.railTitle}>
                        {currentItem ? (
                            <>
                                Assign <Text style={{ fontWeight: '700', color: '#6366f1' }}>{currentItem.name}</Text>
                            </>
                        ) : (
                            "Select an item from receipt"
                        )}
                    </Text>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.membersContainer}
                >
                    {members.map(member => {
                        const isAssigned = currentItem?.assignedTo.includes(member.id);
                        const isDisabled = selectedItemIndex === null;

                        return (
                            <TouchableOpacity
                                key={member.id}
                                style={[
                                    styles.memberChip,
                                    isDisabled && styles.memberChipDisabled
                                ]}
                                onPress={() => handleToggleAssignment(member.id)}
                                disabled={isDisabled}
                                activeOpacity={0.7}
                            >
                                <LinearGradient
                                    colors={isAssigned ? ['#10b981', '#059669'] : ['#f1f5f9', '#e2e8f0']}
                                    style={[styles.avatar, isAssigned && styles.avatarActive]}
                                >
                                    {isAssigned ? (
                                        <Check size={20} color="#fff" strokeWidth={3} />
                                    ) : (
                                        <Text style={styles.avatarText}>{member.name[0]}</Text>
                                    )}
                                </LinearGradient>
                                <Text
                                    style={[
                                        styles.memberName,
                                        isAssigned && styles.memberNameActive
                                    ]}
                                    numberOfLines={1}
                                >
                                    {member.name.split(' ')[0]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    receiptHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    receiptLogo: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
        color: '#94a3b8',
    },
    receiptDate: {
        fontSize: 12,
        color: '#cbd5e1',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    paperContainer: {
        backgroundColor: '#fff',
        flex: 1,
        marginHorizontal: 2,
        borderRadius: 2,
        paddingTop: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        // paper texture effect
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    zigzagTop: {
        // decorative placeholder
    },
    itemsList: {
        flex: 1,
    },
    itemsListContent: {
        paddingHorizontal: 20,
        paddingBottom: 160,
    },
    dashedLine: {
        height: 1,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        borderRadius: 1,
        marginVertical: 12,
    },
    receiptRow: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        marginVertical: 2,
    },
    receiptRowSelected: {
        backgroundColor: '#fef08a', // Highlighter yellow
        transform: [{ rotate: '-0.5deg' }], // Handwriting slant feel
        borderRadius: 2,
    },
    receiptRowAssigned: {
        backgroundColor: '#dcfce7', // Light green highlight
    },
    rowContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    itemMain: {
        flex: 1,
        marginRight: 16,
    },
    itemText: {
        fontSize: 15,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: '#1e293b',
        fontWeight: '500',
        letterSpacing: -0.5,
    },
    itemTextSelected: {
        fontWeight: '700',
        color: '#000',
    },
    assignedToText: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontStyle: 'italic',
    },
    priceText: {
        fontSize: 15,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: '#0f172a',
        fontWeight: '600',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingHorizontal: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    barcodePlaceholder: {
        height: 40,
        backgroundColor: '#f1f5f9',
        marginVertical: 24,
        marginHorizontal: 40,
        borderRadius: 2,
        opacity: 0.5,
    },
    thankYouText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94a3b8',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 20,
    },

    // Floating Rail
    membersRail: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingVertical: 20,
        paddingHorizontal: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    membersRailDisabled: {
        opacity: 0.9,
        transform: [{ translateY: 100 }], // Hide completely if nothing selected for more space
    },
    railHeader: {
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    railTitle: {
        fontSize: 15,
        color: '#64748b',
        fontWeight: '500',
    },
    membersContainer: {
        gap: 16,
        paddingRight: 24,
    },
    memberChip: {
        alignItems: 'center',
        width: 60,
    },
    memberChipDisabled: {
        opacity: 0.4,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarActive: {
        transform: [{ scale: 1.1 }],
        shadowColor: "#10b981",
        shadowOpacity: 0.3,
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#64748b',
    },
    memberName: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
        textAlign: 'center',
    },
    memberNameActive: {
        color: '#10b981',
        fontWeight: '700',
    },
});
