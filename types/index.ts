export interface User {
  id: string;
  auth_id?: string;
  name: string;
  email: string;
  photoUrl?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Trip {
  id: string;
  name: string;
  joinCode: string;
  adminId: string;
  memberIds: string[];
  createdAt: string;
  updated_at?: string;
}

export type SplitType = "equal" | "custom";

export type PaymentStatus = "not_paid" | "pending_approval" | "approved";

export interface SplitMember {
  userId: string;
  amount: number;
  status: PaymentStatus;
  markedPaidAt?: string;
  approvedAt?: string;
}

export interface Split {
  id: string;
  tripId: string;
  name: string;
  totalAmount: number;
  type: SplitType;
  creatorId: string;
  members: SplitMember[];
  createdAt: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: "payment_reminder" | "payment_approved" | "split_created";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedSplitId?: string;
  relatedTripId?: string;
}
export interface User {
  id: string;
  auth_id?: string;
  name: string;
  email: string;
  photoUrl?: string;
  created_at?: string;
  updated_at?: string;
  expoPushToken?: string;
  upiId?: string;
}

export interface Balance {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface Payment {
  id: string;
  splitId: string;
  payerId: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
}

export interface TripEvent {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime?: string;
  createdBy: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: "split_created" | "event_created" | "trip_created" | "member_joined";
  title: string;
  subtitle: string;
  timestamp: string;
  user?: User;
  amount?: number;
  relatedId?: string;
}
