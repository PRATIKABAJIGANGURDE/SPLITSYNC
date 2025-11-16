import createContextHook from "@nkzw/create-context-hook";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, Trip, Split, Notification, SplitType, PaymentStatus } from "@/types";
import { supabase } from "@/lib/supabase";

function generateJoinCode(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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
  }, []);

  const fetchUserProfile = async (authId: string) => {
    const { data } = await supabase
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
      });
    }
  };

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
      if (!currentUser) throw new Error("User not logged in");

      const joinCode = generateJoinCode();

      const { data: trip, error } = await supabase
        .from("trips")
        .insert({
          name,
          join_code: joinCode,
          admin_id: currentUser.id,
        })
        .select()
        .single();

      if (error) throw error;

      const { data: members } = await supabase
        .from("trip_members")
        .select("user_id")
        .eq("trip_id", trip.id);

      return {
        id: trip.id,
        name: trip.name,
        joinCode: trip.join_code,
        adminId: trip.admin_id,
        memberIds: members?.map((m) => m.user_id) || [currentUser.id],
        createdAt: trip.created_at,
      } as Trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });

  const joinTripMutation = useMutation({
    mutationFn: async (joinCode: string) => {
      if (!currentUser) throw new Error("User not logged in");

      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("join_code", joinCode)
        .single();

      if (tripError || !trip) throw new Error("Invalid join code");

      const { data: existingMember } = await supabase
        .from("trip_members")
        .select("*")
        .eq("trip_id", trip.id)
        .eq("user_id", currentUser.id)
        .single();

      if (!existingMember) {
        const { error: memberError } = await supabase
          .from("trip_members")
          .insert({
            trip_id: trip.id,
            user_id: currentUser.id,
          });

        if (memberError) throw memberError;
      }

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["splits"] });
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
      const { error } = await supabase
        .from("split_members")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("split_id", splitId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["splits"] });
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
  const { mutate: approvePaymentMutate } = approvePaymentMutation;

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
      return await loginAsync({ email, password });
    },
    [loginAsync]
  );

  const verifyOtp = useCallback(
    async (email: string, otp: string) => {
      const result = await verifyOtpAsync({ email, otp });
      return result;
    },
    [verifyOtpAsync]
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
    (splitId: string, userId: string) => {
      approvePaymentMutate({ splitId, userId });
    },
    [approvePaymentMutate]
  );

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

    return `Hey! Please complete your payment for the split: *${split.name}*. You still owe ₹${member.amount}. Mark it as paid after completing it.`;
  }, []);

  return {
    currentUser,
    users: usersQuery.data || [],
    trips: tripsQuery.data || [],
    splits: splitsQuery.data || [],
    notifications: notificationsQuery.data || [],
    isLoading: tripsQuery.isLoading || splitsQuery.isLoading || usersQuery.isLoading,
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
    getUserTrips,
    getTripSplits,
    getUserById,
    getTripById,
    getSplitById,
    generateWhatsAppMessage,
  };
});
