import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { supabase } from './supabase';

export const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error("Background location task error:", error);
        return;
    }
    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        if (locations && locations.length > 0) {
            const location = locations[0];
            const { latitude, longitude, heading, speed } = location.coords;

            try {
                let batteryLevel = -1;
                let batteryState = 0;
                try {
                    batteryLevel = await Battery.getBatteryLevelAsync();
                    batteryState = await Battery.getBatteryStateAsync();
                } catch (e) {
                    // Ignore battery fetch errors
                }

                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: userData } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_id', user.id)
                    .single();

                if (!userData) return;

                const { data: trips } = await supabase
                    .from('trip_members')
                    .select('trip_id')
                    .eq('user_id', userData.id);

                if (trips && trips.length > 0) {
                    const updates = trips.map(t => ({
                        trip_id: t.trip_id,
                        user_id: userData.id,
                        latitude,
                        longitude,
                        heading,
                        speed,
                        battery_level: batteryLevel,
                        battery_state: batteryState,
                        updated_at: new Date().toISOString(),
                    }));

                    await supabase.from('live_locations').upsert(updates, { onConflict: 'trip_id,user_id' });
                    // console.log("Updated background location for trips:", trips.length);
                }

            } catch (err) {
                console.error("Error updating background location:", err);
            }
        }
    }
});
