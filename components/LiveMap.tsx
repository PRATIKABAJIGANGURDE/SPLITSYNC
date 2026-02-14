import React, { useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    Switch,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { Trip } from '../types';
import { Navigation, Crosshair, X, Zap, Gauge } from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import MemberMarker from './MemberMarker';
import WalkieTalkie from './WalkieTalkie';
import * as Battery from 'expo-battery';
import LeafletMap from './LeafletMap';

interface LiveMapProps {
    trip: Trip;
    currentUserId: string;
}

export default function LiveMap({ trip, currentUserId }: LiveMapProps) {
    const mapRef = useRef<MapView>(null);
    const { isSharing, toggleSharing, otherMembersLocations } =
        useLiveLocation(trip.id);

    const [currentLocation, setCurrentLocation] =
        useState<Location.LocationObject | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userData, setUserData] = useState<{
        name: string;
        photo_url: string | null;
    } | null>(null);
    const [showHelp, setShowHelp] = useState(true);
    const [selectedMember, setSelectedMember] = useState<any | null>(null);

    const [region, setRegion] = useState({
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    });

    useEffect(() => {
        const fetchUser = async () => {
            const { data } = await supabase
                .from('users')
                .select('name, photo_url')
                .eq('id', currentUserId)
                .single();

            if (data) setUserData(data);
        };

        fetchUser();

        let subscription: Location.LocationSubscription | null = null;

        (async () => {
            try {
                const { status } =
                    await Location.requestForegroundPermissionsAsync();

                if (status !== 'granted') {
                    setIsLoading(false);
                    return;
                }

                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 1000,
                        distanceInterval: 1,
                    },
                    (location) => {
                        setCurrentLocation(location);

                        setIsLoading((prev) => {
                            if (prev) {
                                setRegion({
                                    latitude: location.coords.latitude,
                                    longitude: location.coords.longitude,
                                    latitudeDelta: 0.05,
                                    longitudeDelta: 0.05,
                                });
                                return false;
                            }
                            return prev;
                        });
                    }
                );
            } catch (err) {
                console.error(err);
                setIsLoading(false);
            }
        })();

        return () => subscription?.remove();
    }, []);

    const focusOnMe = async () => {
        const location = await Location.getCurrentPositionAsync({});
        mapRef.current?.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        });
    };

    const getBatteryColor = (level: number, state: number) => {
        if (state === 2) return '#f59e0b';
        if (level <= 0.2) return '#ef4444';
        return '#10b981';
    };

    const getSpeedInfo = (speed: number | undefined) => {
        if (speed === undefined || speed < 0) return { label: 'Unknown', speedMph: 0 };
        const speedMph = Math.round(speed * 2.23694);
        let label = 'Stationary';
        if (speedMph >= 3) label = 'Walking';
        if (speedMph >= 15) label = 'Driving';
        return { label, speedMph };
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Locating you...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {Platform.OS === 'android' ? (
                <LeafletMap
                    currentLocation={currentLocation}
                    otherMembersLocations={otherMembersLocations}
                />
            ) : (
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_DEFAULT}
                    initialRegion={region}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    onPress={() => setSelectedMember(null)}
                >
                    {currentLocation && (
                        <MemberMarker
                            id="current-user"
                            coordinate={{
                                latitude: currentLocation.coords.latitude,
                                longitude: currentLocation.coords.longitude,
                            }}
                            user={{
                                name: userData?.name || 'You',
                                photo_url: userData?.photo_url,
                            }}
                            isCurrentUser
                            onPress={() => setSelectedMember({
                                id: 'current-user',
                                users: { name: 'You', photo_url: userData?.photo_url },
                                battery_level: -1,
                                speed: currentLocation.coords.speed,
                                updated_at: new Date().toISOString()
                            })}
                        />
                    )}

                    {otherMembersLocations.map((loc) => {
                        if (loc.user_id === currentUserId) return null;

                        return (
                            <MemberMarker
                                key={loc.id}
                                id={loc.id}
                                coordinate={{
                                    latitude: loc.latitude,
                                    longitude: loc.longitude,
                                }}
                                user={{
                                    name: loc.users?.name || 'Member',
                                    photo_url: loc.users?.photo_url,
                                }}
                                batteryLevel={loc.battery_level}
                                batteryState={loc.battery_state}
                                onPress={() => setSelectedMember(loc)}
                            />
                        );
                    })}
                </MapView>
            )}

            {/* Top Controls */}
            <View style={styles.topControls}>
                <View style={styles.controlCard}>
                    <Navigation size={18} color="#475569" />
                    <Text style={styles.controlTitle}>
                        Sharing
                    </Text>
                    <Switch
                        trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                        thumbColor="#fff"
                        onValueChange={toggleSharing}
                        value={isSharing}
                    />
                </View>

                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={focusOnMe}
                >
                    <Crosshair size={22} color="#1e293b" />
                </TouchableOpacity>
            </View>

            {/* Top Left Status */}
            <View style={styles.statusBadge}>
                <View
                    style={[
                        styles.statusDot,
                        {
                            backgroundColor: isSharing
                                ? '#22c55e'
                                : '#94a3b8',
                        },
                    ]}
                />
                <Text style={styles.statusText}>
                    {isSharing
                        ? `You are Live • ${otherMembersLocations.length} Active`
                        : 'You are Hidden'}
                </Text>
            </View>

            {/* Help Panel */}
            {showHelp && (
                <View style={styles.helpPanel}>
                    <View style={styles.helpHeader}>
                        <Text style={styles.helpTitle}>Map Guide</Text>
                        <TouchableOpacity onPress={() => setShowHelp(false)}>
                            <X size={20} color="#cbd5f5" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.helpText}>
                        • Toggle sharing to appear
                    </Text>
                    <Text style={styles.helpText}>
                        • Tap crosshair to center
                    </Text>
                    <Text style={styles.helpText}>
                        • See friends in real-time
                    </Text>
                </View>
            )}

            {/* Selected Member Detail Card */}
            {selectedMember && (
                <View style={styles.memberCard}>
                    <View style={styles.memberHeader}>
                        <Text style={styles.memberName}>
                            {selectedMember.users?.name || (selectedMember.id === 'current-user' ? 'You' : 'Member')}
                        </Text>
                        <TouchableOpacity onPress={() => setSelectedMember(null)}>
                            <X size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.memberInfo}>
                        <Zap
                            size={18}
                            color={getBatteryColor(selectedMember.battery_level, selectedMember.battery_state)}
                            fill={selectedMember.battery_state === 2 ? '#f59e0b' : 'none'}
                        />
                        <Text style={styles.memberDetailText}>
                            {selectedMember.battery_level !== undefined && selectedMember.battery_level > -1
                                ? `${Math.round(selectedMember.battery_level * 100)}% Battery`
                                : 'Battery Unknown'}
                        </Text>
                    </View>

                    <View style={styles.memberInfo}>
                        <Gauge size={18} color="#64748b" />
                        <Text style={styles.memberDetailText}>
                            {(() => {
                                const { label, speedMph } = getSpeedInfo(selectedMember.speed);
                                return `${label} • ${speedMph} mph`;
                            })()}
                        </Text>
                    </View>

                    <Text style={styles.lastSeen}>
                        Updated: {new Date(selectedMember.updated_at || Date.now()).toLocaleTimeString()}
                    </Text>
                </View>
            )}

            {/* Walkie Talkie */}
            <WalkieTalkie
                tripId={trip.id}
                currentUser={{
                    id: currentUserId,
                    name: userData?.name || 'You',
                    email: '',
                    photo_url: userData?.photo_url,
                } as any}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 24,
        overflow: 'hidden',
        margin: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },

    map: { width: '100%', height: '100%' },

    center: { justifyContent: 'center', alignItems: 'center' },

    loadingText: {
        marginTop: 10,
        color: '#64748b',
        fontSize: 14,
        fontWeight: '500',
    },

    topControls: {
        position: 'absolute',
        top: 16,
        right: 16,
        gap: 10,
        alignItems: 'flex-end',
    },

    controlCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 8,
        elevation: 5,
    },

    controlTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },

    controlButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
    },

    statusBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
        elevation: 5,
    },

    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },

    statusText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },

    helpPanel: {
        position: 'absolute',
        top: 64, // Pushed down to clear status badge
        left: 16,
        backgroundColor: 'rgba(15,23,42,0.9)',
        padding: 12,
        borderRadius: 12,
        maxWidth: 200, // Reduced width to ensure no overlap
        elevation: 5,
        zIndex: 10,
    },

    helpHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },

    helpTitle: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },

    helpText: {
        color: '#cbd5f5',
        fontSize: 12,
        marginBottom: 2,
    },

    memberCard: {
        position: 'absolute',
        bottom: 180, // Above Walkie Talkie
        alignSelf: 'center',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        width: '85%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 50,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    memberHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    memberName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    memberInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    memberDetailText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    lastSeen: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
});
