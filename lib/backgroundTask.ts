import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { supabase } from './supabase';

export const BACKGROUND_PAYMENT_REMINDER_TASK = 'BACKGROUND_PAYMENT_REMINDER_TASK';

TaskManager.defineTask(BACKGROUND_PAYMENT_REMINDER_TASK, async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const userId = session.user.id;
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 1. Get all splits created by the user that are older than 24 hours
        const { data: splits, error: splitsError } = await supabase
            .from('splits')
            .select(`
        id,
        name,
        created_at,
        split_members (
          user_id,
          amount,
          status,
          last_reminded_at
        )
      `)
            .eq('creator_id', userId)
            .lt('created_at', twentyFourHoursAgo.toISOString());

        if (splitsError || !splits) {
            console.error("Background fetch error (splits):", splitsError);
            return BackgroundFetch.BackgroundFetchResult.Failed;
        }

        let notificationsSent = 0;

        for (const split of splits) {
            // 2. Filter for unpaid members who haven't been reminded in the last 24h
            const unpaidMembers = split.split_members.filter((m: any) => {
                const isUnpaid = m.status === 'not_paid';
                const lastReminded = m.last_reminded_at ? new Date(m.last_reminded_at) : null;
                const notRemindedRecently = !lastReminded || lastReminded < twentyFourHoursAgo;
                const isNotSelf = m.user_id !== userId; // Should not happen if logic is correct, but safe check

                return isUnpaid && notRemindedRecently && isNotSelf;
            });

            for (const member of unpaidMembers) {
                // 3. Get User Token
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('expo_push_token, name')
                    .eq('id', member.user_id)
                    .single();

                if (userError || !user || !user.expo_push_token) continue;

                // 4. Send Notification
                const message = {
                    to: user.expo_push_token,
                    sound: 'default',
                    title: `Overdue Payment: ${split.name}`,
                    body: `Hey ${user.name}, it's been a while! Please settle your share of ₹${member.amount}.`,
                    data: { splitId: split.id },
                };

                try {
                    await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Accept-encoding': 'gzip, deflate',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(message),
                    });

                    // 5. Update last_reminded_at
                    await supabase
                        .from('split_members')
                        .update({ last_reminded_at: new Date().toISOString() })
                        .eq('split_id', split.id)
                        .eq('user_id', member.user_id);

                    // 6. Record Notification
                    await supabase.from("notifications").insert({
                        user_id: member.user_id,
                        type: "payment_reminder",
                        title: `Overdue Payment: ${split.name}`,
                        message: `Automated reminder: Please pay ₹${member.amount} for "${split.name}"`,
                        related_split_id: split.id,
                    });

                    notificationsSent++;
                } catch (error) {
                    console.error("Failed to send push notification:", error);
                }
            }
        }

        return notificationsSent > 0
            ? BackgroundFetch.BackgroundFetchResult.NewData
            : BackgroundFetch.BackgroundFetchResult.NoData;

    } catch (error) {
        console.error("Background task failed:", error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export async function registerBackgroundFetchAsync() {
    return BackgroundFetch.registerTaskAsync(BACKGROUND_PAYMENT_REMINDER_TASK, {
        minimumInterval: 60 * 60, // 1 hour (in seconds)
        stopOnTerminate: false, // Continue even if app is closed (best effort)
        startOnBoot: true, // Android only
    });
}

export async function unregisterBackgroundFetchAsync() {
    return BackgroundFetch.unregisterTaskAsync(BACKGROUND_PAYMENT_REMINDER_TASK);
}
