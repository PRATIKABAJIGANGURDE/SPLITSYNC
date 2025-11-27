import createContextHook from "@nkzw/create-context-hook";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, Trip, Split, Notification, SplitType, PaymentStatus, Balance, Payment, TripEvent, ActivityItem } from "@/types";
import { supabase } from "@/lib/supabase";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

function generateJoinCode(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Only set notification handler if NOT in Expo Go
if (Constants.appOwnership !== 'expo') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const fetchUserProfile = useCallback(async (authId: string) => {
    // First, get the auth user to get email
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    // Try to fetch existing user profile
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authId)
      .single();

    if (data) {
      setCurrentUser({
        id: data.id,
        auth_id: data.auth_id,
        name: data.name,
        email: data.email,
        photoUrl: data.photo_url,
        expoPushToken: data.expo_push_token,
        upiId: data.upi_id,
      });
    } else if (error && error.code === 'PGRST116') {
      // User profile doesn't exist yet, create it
      // Get name from user metadata or use email prefix
      const name = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';

      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          auth_id: authId,
          email: authUser.email || '',
          name: name,
          photo_url: null,
        })
        .select()
        .single();

      if (newUser && !insertError) {
        setCurrentUser({
          id: newUser.id,
          auth_id: newUser.auth_id,
          name: newUser.name,
          email: newUser.email,
          photoUrl: newUser.photo_url,
          expoPushToken: newUser.expo_push_token,
          upiId: newUser.upi_id,
        });
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const registerForPushNotificationsAsync = useCallback(async () => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        return;
      }

      // Check if running in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        console.log("Push notifications are not supported in Expo Go. Please use a development build.");
        return;
      }

      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        const pushTokenString = (
          await Notifications.getExpoPushTokenAsync({ projectId })
        ).data;

        if (currentUser && pushTokenString !== currentUser.expoPushToken) {
          await supabase
            .from("users")
            .update({ expo_push_token: pushTokenString })
            .eq("id", currentUser.id);

          // Optimistically update current user
          setCurrentUser((prev) =>
            prev ? { ...prev, expoPushToken: pushTokenString } : null
          );
        }
      } catch (e) {
        console.error("Error getting push token:", e);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      registerForPushNotificationsAsync();
    }
  }, [currentUser, registerForPushNotificationsAsync]);

  const sendPushNotification = useCallback(
    async (expoPushToken: string, title: string, body: string) => {
      const message = {
        to: expoPushToken,
        sound: "default",
        title,
        body,
        data: { someData: "goes here" },
      };

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
    },
    []
  );

  const tripsQuery = useQuery({
    queryKey: ["trips", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data: tripMembers, error: membersError } = await supabase
        .from("trip_members")
        .select("trip_id")
        .eq("user_id", currentUser.id);

      if (membersError) throw membersError;

      const tripIds = tripMembers.map((tm) => tm.trip_id);
      if (tripIds.length === 0) return [];

      const { data: trips, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .in("id", tripIds)
        .order("created_at", { ascending: false });

      if (tripsError) throw tripsError;

      const tripsWithMembers = await Promise.all(
        trips.map(async (trip) => {
          const { data: members } = await supabase
            .from("trip_members")
            .select("user_id")
            .eq("trip_id", trip.id);

          return {
            id: trip.id,
            name: trip.name,
            joinCode: trip.join_code,
            adminId: trip.admin_id,
            memberIds: members?.map((m) => m.user_id) || [],
            createdAt: trip.created_at,
          } as Trip;
        })
      );

      return tripsWithMembers;
    },
    enabled: !!currentUser,
  });

  const splitsQuery = useQuery({
    queryKey: ["splits", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      const trips = tripsQuery.data || [];
      if (trips.length === 0) return [];

      const tripIds = trips.map((t) => t.id);

      const { data: splits, error: splitsError } = await supabase
        .from("splits")
        .select("*")
        .in("trip_id", tripIds)
        .order("created_at", { ascending: false });

      if (splitsError) throw splitsError;

      const splitsWithMembers = await Promise.all(
        splits.map(async (split) => {
          const { data: members } = await supabase
            .from("split_members")
            .select("*")
            .eq("split_id", split.id);

          return {
            id: split.id,
            tripId: split.trip_id,
            name: split.name,
            totalAmount: parseFloat(split.total_amount),
            type: split.type as SplitType,
            creatorId: split.creator_id,
            members:
              members?.map((m) => ({
                userId: m.user_id,
                amount: parseFloat(m.amount),
                status: m.status as PaymentStatus,
                markedPaidAt: m.marked_paid_at || undefined,
                approvedAt: m.approved_at || undefined,
              })) || [],
            createdAt: split.created_at,
          } as Split;
        })
      );

      return splitsWithMembers;
    },
    enabled: !!currentUser && tripsQuery.isSuccess,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const splits = splitsQuery.data || [];
      if (splits.length === 0) return [];
      const splitIds = splits.map(s => s.id);

      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .in("split_id", splitIds)
        .eq("status", "approved");

      if (error) throw error;
      return data.map((p) => ({
        id: p.id,
        splitId: p.split_id,
        payerId: p.payer_id,
        amount: parseFloat(p.amount),
        status: p.status,
        createdAt: p.created_at,
      })) as Payment[];
    },
    enabled: !!currentUser && splitsQuery.isSuccess,
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("name");

      if (error) throw error;

      return data.map((u) => ({
        id: u.id,
        auth_id: u.auth_id,
        name: u.name,
        email: u.email,
        photoUrl: u.photo_url,
        expoPushToken: u.expo_push_token,
        upiId: u.upi_id,
      })) as User[];
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((n) => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.created_at,
        relatedSplitId: n.related_split_id || undefined,
        relatedTripId: n.related_trip_id || undefined,
      })) as Notification[];
    },
    enabled: !!currentUser,
  });

  const eventsQuery = useQuery({
    queryKey: ["events", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const trips = tripsQuery.data || [];
      if (trips.length === 0) return [];
      const tripIds = trips.map((t) => t.id);

      const { data, error } = await supabase
        .from("trip_events")
        .select("*")
        .in("trip_id", tripIds)
        .order("start_time", { ascending: true });

      if (error) throw error;

      return data.map((e) => ({
        id: e.id,
        tripId: e.trip_id,
        title: e.title,
        description: e.description || undefined,
        location: e.location || undefined,
        startTime: e.start_time,
        endTime: e.end_time || undefined,
        createdBy: e.created_by,
        createdAt: e.created_at,
      })) as TripEvent[];
    },
    enabled: !!currentUser && tripsQuery.isSuccess,
  });

  const signUpMutation = useMutation({
    mutationFn: async ({ email, password, name }: { email: string; password: string; name: string }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            name,
          },
        },
      });

      if (error) throw error;
      return data;
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return data;
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;
      return data;
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) throw error;
      return data;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrentUser(null);
      queryClient.clear();
    },
  });

  const createTripMutation = useMutation({
    mutationFn: async (name: string) => {
      console.log("Starting createTripMutation with name:", name);
      if (!currentUser) {
        console.error("User not logged in during createTripMutation");
        throw new Error("User not logged in");
      }

      const joinCode = generateJoinCode();
      console.log("Generated join code:", joinCode);

      console.log("Inserting trip into database...");
      const { data: trip, error } = await supabase
        .from("trips")
        .insert({
          name,
          join_code: joinCode,
          admin_id: currentUser.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting trip:", error);
        throw error;
      }
      console.log("Trip inserted successfully:", trip);

      // Explicitly add creator as member if not already added by trigger
      // We ignore unique constraint violation (code '23505') which means trigger already added it
      try {
        console.log("Attempting to add creator as member...");
        const { error: memberError } = await supabase
          .from("trip_members")
          .insert({
            trip_id: trip.id,
            user_id: currentUser.id,
          });

        if (memberError) {
          if (memberError.code === '23505') {
            console.log("Creator was already added as member (likely by trigger).");
          } else {
            console.warn("Failed to add creator as member:", memberError);
          }
        } else {
          console.log("Creator added as member successfully.");
        }
      } catch (e) {
        console.error("Exception while adding creator as member:", e);
      }

      // Refetch members to be sure
      console.log("Refetching trip members...");
      const { data: updatedMembers, error: fetchMembersError } = await supabase
        .from("trip_members")
        .select("user_id")
        .eq("trip_id", trip.id);

      if (fetchMembersError) {
        console.error("Error fetching updated members:", fetchMembersError);
      } else {
        console.log("Updated members fetched:", updatedMembers);
      }

      const resultTrip = {
        id: trip.id,
        name: trip.name,
        joinCode: trip.join_code,
        adminId: trip.admin_id,
        memberIds: updatedMembers?.map((m) => m.user_id) || [currentUser.id],
        createdAt: trip.created_at,
      } as Trip;

      console.log("createTripMutation returning:", resultTrip);
      return resultTrip;
    },
    onSuccess: async () => {
      console.log("createTripMutation onSuccess triggered. Invalidating 'trips' query.");
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      console.error("Create trip failed:", error);
    },
  });

  const joinTripMutation = useMutation({
    mutationFn: async (joinCode: string) => {
      console.log("Joining trip with code:", joinCode);
      if (!currentUser) throw new Error("User not logged in");

      // Use RPC function to bypass RLS for lookup
      const { data: rpcResult, error } = await supabase.rpc("get_trip_by_join_code", {
        code: joinCode,
      });

      if (error) {
        console.error("Error joining trip (RPC):", error);
        throw error;
      }

      // RPC returning TABLE returns an array
      const trip = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

      if (!trip) {
        throw new Error("Trip not found or invalid code");
      }

      console.log("RPC Result:", trip);

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("trip_members")
        .select("*")
        .eq("trip_id", trip.id)
        .eq("user_id", currentUser.id)
        .single();

      if (!existingMember) {
        const { error: joinError } = await supabase
          .from("trip_members")
          .insert({
            trip_id: trip.id,
            user_id: currentUser.id,
          });
        if (joinError) throw joinError;
      }

      return {
        id: trip.id,
        name: trip.name,
        joinCode: trip.join_code,
        adminId: trip.admin_id,
        memberIds: [], // We can fetch members later or return empty for now
        createdAt: trip.created_at,
      } as Trip;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });

  const createSplitMutation = useMutation({
    mutationFn: async ({
      tripId,
      name,
      totalAmount,
      type,
      members,
    }: {
      tripId: string;
      name: string;
      totalAmount: number;
      type: SplitType;
      members: { userId: string; amount: number }[];
    }) => {
      if (!currentUser) throw new Error("User not logged in");

      const { data: split, error: splitError } = await supabase
        .from("splits")
        .insert({
          trip_id: tripId,
          name,
          total_amount: totalAmount,
          type,
          creator_id: currentUser.id,
        })
        .select()
        .single();

      if (splitError) throw splitError;

      const { error: membersError } = await supabase
        .from("split_members")
        .insert(
          members.map((m) => ({
            split_id: split.id,
            user_id: m.userId,
            amount: m.amount,
            status: "not_paid",
          }))
        );

      if (membersError) throw membersError;

      return {
        id: split.id,
        tripId: split.trip_id,
        name: split.name,
        totalAmount: parseFloat(split.total_amount),
        type: split.type as SplitType,
        creatorId: split.creator_id,
        members: members.map((m) => ({
          userId: m.userId,
          amount: m.amount,
          status: "not_paid" as PaymentStatus,
        })),
        createdAt: split.created_at,
      } as Split;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["splits"] });

      // Send notifications to members
      data.members.forEach((member) => {
        if (member.userId !== currentUser?.id) {
          const user = usersQuery.data?.find((u) => u.id === member.userId);
          if (user?.expoPushToken) {
            const trip = tripsQuery.data?.find((t) => t.id === data.tripId);
            const tripName = trip?.name || "Trip";

            sendPushNotification(
              user.expoPushToken,
              `New Split: ${data.name}`,
              `Trip: ${tripName}\nAmount: ₹${member.amount}\nWhen you gone return the money bro?`
            );
          }
        }
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (splitId: string) => {
      if (!currentUser) throw new Error("User not logged in");

      const { error } = await supabase
        .from("split_members")
        .update({
          status: "pending_approval",
          marked_paid_at: new Date().toISOString(),
        })
        .eq("split_id", splitId)
        .eq("user_id", currentUser.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["splits"] });
    },
  });

  const approvePaymentMutation = useMutation({
    mutationFn: async ({ splitId, userId }: { splitId: string; userId: string }) => {
      // 1. Update split_members status
      const { error: memberError } = await supabase
        .from("split_members")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("split_id", splitId)
        .eq("user_id", userId);

      if (memberError) throw memberError;

      // 2. Update all pending payments to approved
      const { error: paymentsError } = await supabase
        .from("payments")
        .update({ status: "approved" })
        .eq("split_id", splitId)
        .eq("payer_id", userId)
        .eq("status", "pending");

      if (paymentsError) throw paymentsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["splits"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: async ({ splitId, userId }: { splitId: string; userId: string }) => {
      // 1. Update all pending payments to rejected
      const { error: paymentsError } = await supabase
        .from("payments")
        .update({ status: "rejected" })
        .eq("split_id", splitId)
        .eq("payer_id", userId)
        .eq("status", "pending");

      if (paymentsError) throw paymentsError;

      // 2. Update split_members status back to not_paid if it was pending_approval
      const { error: memberError } = await supabase
        .from("split_members")
        .update({
          status: "not_paid",
          marked_paid_at: null,
        })
        .eq("split_id", splitId)
        .eq("user_id", userId)
        .eq("status", "pending_approval");

      if (memberError) throw memberError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["splits"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });

  const deleteSplitMutation = useMutation({
    mutationFn: async (splitId: string) => {
      console.log("deleteSplitMutation: Starting deletion for split:", splitId);
      if (!currentUser) throw new Error("User not logged in");

      console.log("deleteSplitMutation: Deleting split_members...");
      const { error: membersError } = await supabase
        .from("split_members")
        .delete()
        .eq("split_id", splitId);

      if (membersError) {
        console.error("deleteSplitMutation: Error deleting split_members:", membersError);
        throw membersError;
      }

      console.log("deleteSplitMutation: Deleting split...");
      const { error } = await supabase
        .from("splits")
        .delete()
        .eq("id", splitId);

      if (error) {
        console.error("deleteSplitMutation: Error deleting split:", error);
        throw error;
      }
      console.log("deleteSplitMutation: Split deleted successfully");
    },
    onSuccess: () => {
      console.log("deleteSplitMutation: onSuccess triggered");
      queryClient.invalidateQueries({ queryKey: ["splits", currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["trips", currentUser?.id] });
    },
    onError: (error) => {
      console.error("deleteSplitMutation: onError triggered:", error);
    },
  });

  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: string) => {
      console.log("deleteTripMutation: Starting deletion for trip:", tripId);
      if (!currentUser) throw new Error("User not logged in");

      console.log("deleteTripMutation: Deleting trip...");
      const { error } = await supabase
        .from("trips")
        .delete()
        .eq("id", tripId);

      if (error) {
        console.error("deleteTripMutation: Error deleting trip:", error);
        throw error;
      }
      console.log("deleteTripMutation: Trip deleted successfully");
    },
    onSuccess: () => {
      console.log("deleteTripMutation: onSuccess triggered");
      queryClient.invalidateQueries({ queryKey: ["trips", currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["splits", currentUser?.id] });
    },
    onError: (error) => {
      console.error("deleteTripMutation: onError triggered:", error);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ tripId, userId }: { tripId: string; userId: string }) => {
      console.log("removeMemberMutation: Starting removal for trip:", tripId, "user:", userId);
      if (!currentUser) throw new Error("User not logged in");

      console.log("removeMemberMutation: Deleting trip_member...");
      const { error } = await supabase
        .from("trip_members")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId);

      if (error) {
        console.error("removeMemberMutation: Error removing member:", error);
        throw error;
      }
      console.log("removeMemberMutation: Member removed successfully");
    },
    onSuccess: () => {
      console.log("removeMemberMutation: onSuccess triggered");
      queryClient.invalidateQueries({ queryKey: ["trips", currentUser?.id] });
    },
    onError: (error) => {
      console.error("removeMemberMutation: onError triggered:", error);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ name, upiId }: { name: string; upiId: string }) => {
      if (!currentUser) throw new Error("User not logged in");

      const { error } = await supabase
        .from("users")
        .update({ name, upi_id: upiId })
        .eq("id", currentUser.id);

      if (error) throw error;

      // Optimistically update current user
      setCurrentUser((prev) => (prev ? { ...prev, name, upiId } : null));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ splitId, amount }: { splitId: string; amount: number }) => {
      if (!currentUser) throw new Error("User not logged in");

      const { error } = await supabase
        .from("payments")
        .insert({
          split_id: splitId,
          payer_id: currentUser.id,
          amount,
          status: "pending",
        });

      if (error) throw error;

      // Notify the creator
      const split = splitsQuery.data?.find((s) => s.id === splitId);
      if (split) {
        const creator = usersQuery.data?.find((u) => u.id === split.creatorId);
        if (creator?.expoPushToken && creator.id !== currentUser.id) {
          sendPushNotification(
            creator.expoPushToken,
            "Payment Recorded",
            `${currentUser.name} recorded a payment of ₹${amount} for ${split.name}. Please approve it.`
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["splits"] });
    },
  });

  const approvePaymentRequestMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      // 1. Approve the payment
      const { data: payment, error } = await supabase
        .from("payments")
        .update({ status: "approved" })
        .eq("id", paymentId)
        .select()
        .single();

      if (error) throw error;

      // 2. Check if total approved payments cover the debt
      if (payment) {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("split_id", payment.split_id)
          .eq("payer_id", payment.payer_id)
          .eq("status", "approved");

        const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;

        const { data: member } = await supabase
          .from("split_members")
          .select("amount")
          .eq("split_id", payment.split_id)
          .eq("user_id", payment.payer_id)
          .single();

        if (member && totalPaid >= parseFloat(member.amount)) {
          await supabase
            .from("split_members")
            .update({
              status: "approved",
              approved_at: new Date().toISOString()
            })
            .eq("split_id", payment.split_id)
            .eq("user_id", payment.payer_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["splits"] });
    },
  });

  const rejectPaymentRequestMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: "rejected" })
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async ({
      tripId,
      title,
      description,
      location,
      startTime,
      endTime,
    }: {
      tripId: string;
      title: string;
      description?: string;
      location?: string;
      startTime: string;
      endTime?: string;
    }) => {
      if (!currentUser) throw new Error("User not logged in");

      const { data, error } = await supabase
        .from("trip_events")
        .insert({
          trip_id: tripId,
          title,
          description,
          location,
          start_time: startTime,
          end_time: endTime,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("trip_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const { mutateAsync: signUpAsync, isPending: isSigningUp, error: signUpError } = signUpMutation;
  const { mutateAsync: loginAsync, isPending: isLoggingIn, error: loginError } = loginMutation;
  const { mutateAsync: verifyOtpAsync, isPending: isVerifyingOtp, error: verifyOtpError } = verifyOtpMutation;
  const { mutateAsync: resendOtpAsync, isPending: isResendingOtp } = resendOtpMutation;
  const { mutate: logoutMutate } = logoutMutation;
  const { mutateAsync: createTripAsync } = createTripMutation;
  const { mutateAsync: joinTripAsync } = joinTripMutation;
  const { mutateAsync: createSplitAsync } = createSplitMutation;
  const { mutate: markAsPaidMutate } = markAsPaidMutation;
  const { mutateAsync: approvePaymentMutateAsync } = approvePaymentMutation;
  const { mutateAsync: rejectPaymentMutateAsync } = rejectPaymentMutation;
  const { mutateAsync: deleteSplitAsync } = deleteSplitMutation;
  const { mutateAsync: deleteTripAsync } = deleteTripMutation;
  const { mutateAsync: removeMemberAsync } = removeMemberMutation;
  const { mutateAsync: updateProfileAsync } = updateProfileMutation;
  const { mutateAsync: recordPaymentAsync } = recordPaymentMutation;
  const { mutateAsync: approvePaymentRequestAsync } = approvePaymentRequestMutation;
  const { mutateAsync: rejectPaymentRequestAsync } = rejectPaymentRequestMutation;
  const { mutateAsync: createEventAsync } = createEventMutation;
  const { mutateAsync: deleteEventAsync } = deleteEventMutation;

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await signUpAsync({ email, password, name });

      if (result.user) {
        await supabase.from("users").insert({
          auth_id: result.user.id,
          email: result.user.email,
          name,
          photo_url: null,
        });
      }

      return result;
    },
    [signUpAsync]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginAsync({ email, password });

      if (result.user) {
        await fetchUserProfile(result.user.id);
      }

      return result;
    },
    [loginAsync, fetchUserProfile]
  );

  const verifyOtp = useCallback(
    async (email: string, otp: string) => {
      const result = await verifyOtpAsync({ email, otp });

      if (result.user) {
        await fetchUserProfile(result.user.id);
      }

      return result;
    },
    [verifyOtpAsync, fetchUserProfile]
  );

  const resendOtp = useCallback(
    async (email: string) => {
      return await resendOtpAsync(email);
    },
    [resendOtpAsync]
  );

  const logout = useCallback(() => {
    logoutMutate();
  }, [logoutMutate]);

  const createTrip = useCallback(
    async (name: string): Promise<Trip> => {
      const result = await createTripAsync(name);
      return result;
    },
    [createTripAsync]
  );

  const joinTrip = useCallback(
    async (joinCode: string): Promise<Trip | null> => {
      try {
        const result = await joinTripAsync(joinCode);
        return result;
      } catch (error) {
        console.error("Join trip error:", error);
        return null;
      }
    },
    [joinTripAsync]
  );

  const createSplit = useCallback(
    async (
      tripId: string,
      name: string,
      totalAmount: number,
      type: SplitType,
      members: { userId: string; amount: number }[]
    ): Promise<Split> => {
      const result = await createSplitAsync({
        tripId,
        name,
        totalAmount,
        type,
        members,
      });
      return result;
    },
    [createSplitAsync]
  );

  const markAsPaid = useCallback(
    (splitId: string) => {
      markAsPaidMutate(splitId);
    },
    [markAsPaidMutate]
  );

  const approvePayment = useCallback(
    async (splitId: string, userId: string) => {
      await approvePaymentMutateAsync({ splitId, userId });
    },
    [approvePaymentMutateAsync]
  );

  const rejectPayment = useCallback(
    async (splitId: string, userId: string) => {
      await rejectPaymentMutateAsync({ splitId, userId });
    },
    [rejectPaymentMutateAsync]
  );

  const deleteSplit = useCallback(
    async (splitId: string) => {
      await deleteSplitAsync(splitId);
    },
    [deleteSplitAsync]
  );

  const deleteTrip = useCallback(
    async (tripId: string) => {
      await deleteTripAsync(tripId);
    },
    [deleteTripAsync]
  );

  const removeMember = useCallback(
    async (tripId: string, userId: string) => {
      await removeMemberAsync({ tripId, userId });
    },
    [removeMemberAsync]
  );

  const updateProfile = useCallback(
    async (name: string, upiId: string) => {
      await updateProfileAsync({ name, upiId });
    },
    [updateProfileAsync]
  );

  const createEvent = useCallback(
    async (
      tripId: string,
      title: string,
      startTime: string,
      description?: string,
      location?: string,
      endTime?: string
    ) => {
      await createEventAsync({
        tripId,
        title,
        startTime,
        description,
        location,
        endTime,
      });
    },
    [createEventAsync]
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      await deleteEventAsync(eventId);
    },
    [deleteEventAsync]
  );

  const getTripEvents = useCallback(
    (tripId: string): TripEvent[] => {
      const allEvents = eventsQuery.data || [];
      return allEvents.filter((e) => e.tripId === tripId);
    },
    [eventsQuery.data]
  );

  const recordPayment = useCallback(
    async (splitId: string, amount: number) => {
      await recordPaymentAsync({ splitId, amount });
    },
    [recordPaymentAsync]
  );

  const approvePaymentRequest = useCallback(
    async (paymentId: string) => {
      await approvePaymentRequestAsync(paymentId);
    },
    [approvePaymentRequestAsync]
  );

  const rejectPaymentRequest = useCallback(
    async (paymentId: string) => {
      await rejectPaymentRequestAsync(paymentId);
    },
    [rejectPaymentRequestAsync]
  );

  const getSplitPayments = useCallback(async (splitId: string): Promise<Payment[]> => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("split_id", splitId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching payments:", error);
      return [];
    }

    return data.map((p) => ({
      id: p.id,
      splitId: p.split_id,
      payerId: p.payer_id,
      amount: parseFloat(p.amount),
      status: p.status,
      createdAt: p.created_at,
    }));
  }, []);

  const getUserTrips = useCallback((): Trip[] => {
    return tripsQuery.data || [];
  }, [tripsQuery.data]);

  const getTripSplits = useCallback(
    (tripId: string): Split[] => {
      const allSplits = splitsQuery.data || [];
      return allSplits.filter((split) => split.tripId === tripId);
    },
    [splitsQuery.data]
  );

  const getUserById = useCallback(
    (userId: string): User | undefined => {
      const allUsers = usersQuery.data || [];
      return allUsers.find((u) => u.id === userId);
    },
    [usersQuery.data]
  );

  const getTripById = useCallback(
    (tripId: string): Trip | undefined => {
      const allTrips = tripsQuery.data || [];
      return allTrips.find((t) => t.id === tripId);
    },
    [tripsQuery.data]
  );

  const getSplitById = useCallback(
    (splitId: string): Split | undefined => {
      const allSplits = splitsQuery.data || [];
      return allSplits.find((s) => s.id === splitId);
    },
    [splitsQuery.data]
  );

  const generateWhatsAppMessage = useCallback((split: Split, userId: string): string => {
    const member = split.members.find((m) => m.userId === userId);
    if (!member) return "";

    return `Hey! Please complete your payment for the split: *${split.name}*. You still owe ₹${member.amount}. When you gone return the money bro?`;
  }, []);

  const calculateTripBalances = useCallback((tripId: string): Balance[] => {
    const tripSplits = getTripSplits(tripId);
    const approvedPayments = paymentsQuery.data || [];
    const balances: Record<string, number> = {};

    // Calculate net balances
    tripSplits.forEach((split) => {
      // Creator paid the full amount
      // balances[split.creatorId] = (balances[split.creatorId] || 0) + split.totalAmount;

      // Members owe their share
      split.members.forEach((member) => {
        let amountOwed = member.amount;

        // Deduct approved payments for this specific split and member
        const memberPayments = approvedPayments.filter(p => p.splitId === split.id && p.payerId === member.userId);
        const paidAmount = memberPayments.reduce((sum, p) => sum + p.amount, 0);

        amountOwed -= paidAmount;

        // If explicitly marked as approved (legacy), assume 0 debt
        if (member.status === 'approved') {
          amountOwed = 0;
        }

        // Creator lent this amount
        balances[split.creatorId] = (balances[split.creatorId] || 0) + amountOwed;
        // Member borrowed this amount
        balances[member.userId] = (balances[member.userId] || 0) - amountOwed;
      });
    });

    // Separate into debtors and creditors
    const debtors: { userId: string; amount: number }[] = [];
    const creditors: { userId: string; amount: number }[] = [];

    Object.entries(balances).forEach(([userId, amount]) => {
      // Round to 2 decimal places to avoid floating point errors
      const roundedAmount = Math.round(amount * 100) / 100;
      if (roundedAmount < -0.01) {
        debtors.push({ userId, amount: roundedAmount });
      } else if (roundedAmount > 0.01) {
        creditors.push({ userId, amount: roundedAmount });
      }
    });

    // Sort by magnitude (optional, but helps reduce transactions)
    debtors.sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount); // Descending (most positive first)

    const result: Balance[] = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      // The amount to settle is the minimum of what debtor owes and creditor is owed
      const amount = Math.min(Math.abs(debtor.amount), creditor.amount);

      // Round to 2 decimal places
      const roundedAmount = Math.round(amount * 100) / 100;

      if (roundedAmount > 0) {
        result.push({
          fromUserId: debtor.userId,
          toUserId: creditor.userId,
          amount: roundedAmount,
        });
      }

      // Update remaining amounts
      debtor.amount += roundedAmount;
      creditor.amount -= roundedAmount;

      // Check if settled (using small epsilon for float comparison)
      if (Math.abs(debtor.amount) < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return result;
  }, [getTripSplits, paymentsQuery.data]);

  const getTripActivity = useCallback(async (tripId: string): Promise<ActivityItem[]> => {
    const trip = getTripById(tripId);
    if (!trip) return [];

    const activity: ActivityItem[] = [];

    // 1. Trip Created
    activity.push({
      id: `trip-created-${trip.id}`,
      type: "trip_created",
      title: "created the trip",
      subtitle: `Trip "${trip.name}" was created`,
      timestamp: trip.createdAt,
      user: getUserById(trip.adminId),
      relatedId: trip.id,
    });

    // 2. Splits Created
    const tripSplits = getTripSplits(tripId);
    tripSplits.forEach((split) => {
      activity.push({
        id: `split-created-${split.id}`,
        type: "split_created",
        title: "added a split",
        subtitle: `${split.name}`,
        timestamp: split.createdAt,
        user: getUserById(split.creatorId),
        amount: split.totalAmount,
        relatedId: split.id,
      });
    });

    // 3. Events Created
    const tripEvents = getTripEvents(tripId);
    tripEvents.forEach((event) => {
      activity.push({
        id: `event-created-${event.id}`,
        type: "event_created",
        title: "added an event",
        subtitle: `${event.title}`,
        timestamp: event.createdAt,
        user: getUserById(event.createdBy),
        relatedId: event.id,
      });
    });

    // 4. Members Joined
    try {
      console.log("Fetching trip members for activity...");
      const { data: members, error } = await supabase
        .from("trip_members")
        .select("user_id, created_at")
        .eq("trip_id", tripId);

      if (error) {
        console.error("Error fetching trip members:", error);
      }

      if (members) {
        console.log("Fetched members:", members.length, members);
        members.forEach((member) => {
          if (member.created_at) {
            const joinedDate = new Date(member.created_at);
            activity.push({
              id: `member-joined-${member.user_id}-${tripId}`,
              type: "member_joined",
              title: "joined the trip",
              subtitle: `Joined on ${joinedDate.toLocaleDateString()} at ${joinedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              timestamp: member.created_at,
              user: getUserById(member.user_id),
              relatedId: member.user_id,
            });
          } else {
            console.log("Member has no created_at:", member);
          }
        });
      }

    } catch (e) {
      console.error("Error fetching trip members activity:", e);
    }

    // 5. Payments (Approved and Recorded)
    try {
      const splitIds = tripSplits.map((s) => s.id);
      console.log("Fetching payments for splits:", splitIds);
      if (splitIds.length > 0) {
        const { data: payments, error } = await supabase
          .from("payments")
          .select("*")
          .in("split_id", splitIds)
          .in("status", ["approved", "pending"]); // Fetch both approved and pending

        if (error) {
          console.error("Error fetching payments for activity:", error);
        } else if (payments) {
          console.log("Fetched payments for activity:", payments.length, payments);
          payments.forEach((payment) => {
            const split = tripSplits.find((s) => s.id === payment.split_id);
            const isApproved = payment.status === "approved";

            activity.push({
              id: `payment-${payment.status}-${payment.id}`,
              type: isApproved ? "payment_approved" : "payment_recorded",
              title: isApproved ? "paid for a split" : "recorded a payment",
              subtitle: `${isApproved ? "Paid" : "Recorded"} ₹${payment.amount} for ${split?.name || "a split"}`,
              timestamp: payment.created_at,
              user: getUserById(payment.payer_id),
              amount: parseFloat(payment.amount),
              relatedId: payment.split_id,
            });
          });
        }
      }
    } catch (e) {
      console.error("Error fetching payment activity:", e);
    }

    // Sort by timestamp descending
    const sortedActivity = activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    console.log("Final activity list:", sortedActivity.length);
    return sortedActivity;
  }, [getTripById, getTripSplits, getTripEvents, getUserById]);

  return {
    currentUser,
    users: usersQuery.data || [],
    trips: tripsQuery.data || [],
    splits: splitsQuery.data || [],
    events: eventsQuery.data || [],
    notifications: notificationsQuery.data || [],
    isLoading: tripsQuery.isLoading || splitsQuery.isLoading || usersQuery.isLoading || paymentsQuery.isLoading || eventsQuery.isLoading,
    isRefetching: tripsQuery.isRefetching || splitsQuery.isRefetching || usersQuery.isRefetching || paymentsQuery.isRefetching || eventsQuery.isRefetching,
    signUp,
    login,
    logout,
    verifyOtp,
    resendOtp,
    isSigningUp,
    isLoggingIn,
    isVerifyingOtp,
    isResendingOtp,
    signUpError,
    loginError,
    verifyOtpError,
    createTrip,
    joinTrip,
    createSplit,
    markAsPaid,
    approvePayment,
    rejectPayment,
    getUserTrips,
    getTripSplits,
    getUserById,
    getTripById,
    getSplitById,
    generateWhatsAppMessage,
    deleteSplit,
    deleteTrip,
    removeMember,
    calculateTripBalances,
    updateProfile,
    recordPayment,
    approvePaymentRequest,
    rejectPaymentRequest,
    getSplitPayments,
    createEvent,
    deleteEvent,
    getTripEvents,
    getTripActivity,
    refreshData: async () => {
      await Promise.all([
        tripsQuery.refetch(),
        splitsQuery.refetch(),
        usersQuery.refetch(),
        paymentsQuery.refetch(),
        eventsQuery.refetch(),
        notificationsQuery.refetch(),
      ]);
    },
  };
});
