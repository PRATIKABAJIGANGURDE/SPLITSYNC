import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { LOCATION_TASK_NAME } from '../lib/locationTask';

export const useLiveLocation = (tripId: string) => {
    const [isSharing, setIsSharing] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
    const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
    const [otherMembersLocations, setOtherMembersLocations] = useState<any[]>([]);

    // Check permissions on mount
    useEffect(() => {
        (async () => {
            const { status } = await Location.getForegroundPermissionsAsync();
            setPermissionStatus(status);

            const isTaskRegistered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            setIsSharing(isTaskRegistered);
        })();
    }, []);

    // Request Permissions
    const requestPermissions = async () => {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
            Alert.alert('Permission Denied', 'We need location permission to share your live position.');
            return false;
        }

        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
            Alert.alert('Background Permission Denied', 'We need "Always Allow" permission to keep sharing location when the app is closed.');
            return false;
        }

        setPermissionStatus(bgStatus);
        return true;
    };

    // Toggle Sharing
    const toggleSharing = async () => {
        try {
            if (isSharing) {
                // Stop sharing
                await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
                setIsSharing(false);
            } else {
                // Start sharing
                const hasPermission = await requestPermissions();
                if (!hasPermission) return;

                await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 10000, // Update every 10 seconds
                    distanceInterval: 10, // Or every 10 meters
                    showsBackgroundLocationIndicator: true,
                    foregroundService: {
                        notificationTitle: "Sharing Live Location",
                        notificationBody: "You are sharing your location with trip members.",
                        notificationColor: "#3B82F6",
                    },
                });
                setIsSharing(true);
            }
        } catch (error) {
            console.error("Error toggling location:", error);
            Alert.alert("Error", "Could not toggle location sharing.");
        }
    };

    // Subscribe to Realtime Updates for this Trip
    useEffect(() => {
        if (!tripId) return;

        // Fetch initial locations
        const fetchLocations = async () => {
            const { data } = await supabase
                .from('live_locations')
                .select(`
          *,
          users (
            id,
            name,
            photo_url
          )
        `)
                .eq('trip_id', tripId);

            if (data) setOtherMembersLocations(data);
        };

        fetchLocations();

        const channel = supabase
            .channel(`live_locations:${tripId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'live_locations',
                    filter: `trip_id=eq.${tripId}`,
                },
                (payload) => {
                    // Reload all locations to get joined user data easily (or simpler: just update the specific row in state)
                    // For v1, fetching all is safer to ensure we have user details.
                    fetchLocations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tripId]);

    return {
        isSharing,
        toggleSharing,
        otherMembersLocations,
        permissionStatus
    };
};
