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
