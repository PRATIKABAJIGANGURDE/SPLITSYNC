import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import { Zap } from 'lucide-react-native';

interface MemberMarkerProps {
    id: string;
    coordinate: { latitude: number; longitude: number };
    user: {
        name: string;
        photo_url?: string | null;
    };
    isCurrentUser?: boolean;
    batteryLevel?: number;
    batteryState?: number;
    onPress?: () => void;
}

export default function MemberMarker({
    coordinate,
    user,
    isCurrentUser,
    batteryLevel,
    batteryState,
    onPress,
}: MemberMarkerProps) {

    const [trackChanges, setTrackChanges] = useState(true);

    // Stop tracking after render for performance
    useEffect(() => {
        const timeout = setTimeout(() => setTrackChanges(false), 500);
        return () => clearTimeout(timeout);
    }, [coordinate, batteryLevel, batteryState]);

    const borderColor = isCurrentUser ? '#10b981' : '#3b82f6';
    const bgColor = isCurrentUser ? '#059669' : '#475569';

    // Battery Logic
    const hasBattery = batteryLevel !== undefined && batteryLevel > -1;
    const percent = hasBattery ? Math.round(batteryLevel! * 100) : 0;
    const isCharging = batteryState === 2; // Expo Battery.BatteryState.CHARGING

    let batColor = '#10b981'; // Green
    if (percent <= 20) batColor = '#ef4444'; // Red
    if (isCharging) batColor = '#f59e0b'; // Amber/Gold

    return (
        <Marker
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={trackChanges}
            onPress={onPress}
        >
            <View style={styles.container}>

                <View style={[styles.avatarContainer, { borderColor }]}>
                    {user.photo_url ? (
                        <Image
                            source={{ uri: user.photo_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: bgColor }]}>
                            <Text style={styles.avatarText}>
                                {(user.name?.[0] || "?").toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={[styles.arrow, { borderTopColor: borderColor }]} />

                {/* Small Name Tag (Always Visible) */}
                <View style={styles.nameTag}>
                    <Text style={styles.nameText} numberOfLines={1}>
                        {isCurrentUser ? "You" : user.name}
                    </Text>
                    {hasBattery && (
                        <View style={styles.batteryContainer}>
                            <View style={styles.separator} />
                            {isCharging && <Zap size={10} color={batColor} fill={batColor} />}
                            <Text style={[styles.batteryText, { color: batColor }]}>
                                {percent}%
                            </Text>
                        </View>
                    )}
                </View>

            </View>
        </Marker>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },

    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 3,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 6,

        zIndex: 3,
    },

    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },

    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },

    avatarText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },

    arrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 7,
        borderRightWidth: 7,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',

        marginTop: -2,
        zIndex: 2,
    },

    nameTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 4,
        gap: 6,

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,

        borderWidth: 1,
        borderColor: '#e5e7eb',
        maxWidth: 180,

        zIndex: 1,
    },

    nameText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        maxWidth: 80,
    },

    batteryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },

    separator: {
        width: 1,
        height: 10,
        backgroundColor: '#e2e8f0',
        marginRight: 2,
    },

    batteryText: {
        fontSize: 10,
        fontWeight: '700',
    },
});
