# SplitSync Database Schema

## Setup Instructions

Run these SQL commands in your Supabase SQL Editor (https://atdlqhmggxkkwogxgrwy.supabase.co/project/atdlqhmggxkkwogxgrwy/sql)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (stores user profiles)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip members (junction table)
CREATE TABLE trip_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Splits table
CREATE TABLE splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('equal', 'custom')),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Split members (junction table with payment tracking)
CREATE TABLE split_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_id UUID REFERENCES splits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_paid' CHECK (status IN ('not_paid', 'pending_approval', 'approved')),
  marked_paid_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(split_id, user_id)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payment_reminder', 'payment_approved', 'split_created')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  related_split_id UUID REFERENCES splits(id) ON DELETE CASCADE,
  related_trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX idx_splits_trip_id ON splits(trip_id);
CREATE INDEX idx_split_members_split_id ON split_members(split_id);
CREATE INDEX idx_split_members_user_id ON split_members(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_trips_join_code ON trips(join_code);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Can read all users, can update own profile
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = auth_id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = auth_id);

-- Trips: Can read trips they're a member of, can create new trips
CREATE POLICY "Users can read trips they're members of" ON trips FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM trip_members 
    WHERE trip_members.trip_id = trips.id 
    AND trip_members.user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  ));

CREATE POLICY "Users can create trips" ON trips FOR INSERT WITH CHECK (
  admin_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "Trip admins can update their trips" ON trips FOR UPDATE USING (
  admin_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Trip members: Can read members of trips they're in, can join trips
CREATE POLICY "Users can read trip members" ON trip_members FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM trip_members tm 
    WHERE tm.trip_id = trip_members.trip_id 
    AND tm.user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  ));

CREATE POLICY "Users can join trips" ON trip_members FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Splits: Can read splits from trips they're in, trip members can create splits
CREATE POLICY "Users can read splits from their trips" ON splits FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM trip_members 
    WHERE trip_members.trip_id = splits.trip_id 
    AND trip_members.user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  ));

CREATE POLICY "Trip members can create splits" ON splits FOR INSERT WITH CHECK (
  creator_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM trip_members 
    WHERE trip_members.trip_id = splits.trip_id 
    AND trip_members.user_id = creator_id
  )
);

-- Split members: Can read split members, can update own payment status, creators can approve
CREATE POLICY "Users can read split members" ON split_members FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM splits s
    JOIN trip_members tm ON tm.trip_id = s.trip_id
    WHERE s.id = split_members.split_id
    AND tm.user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  ));

CREATE POLICY "Users can insert split members when creating split" ON split_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM splits s
    WHERE s.id = split_members.split_id
    AND s.creator_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);

CREATE POLICY "Users can update own payment status" ON split_members FOR UPDATE USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM splits s
    WHERE s.id = split_members.split_id
    AND s.creator_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);

-- Notifications: Can read own notifications
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT 
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE 
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Function to generate unique 10-digit join code
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
    SELECT EXISTS(SELECT 1 FROM trips WHERE join_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-add trip creator as member
CREATE OR REPLACE FUNCTION add_creator_to_trip()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trip_members (trip_id, user_id)
  VALUES (NEW.id, NEW.admin_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_creator_to_trip
  AFTER INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_to_trip();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_splits_updated_at BEFORE UPDATE ON splits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_split_members_updated_at BEFORE UPDATE ON split_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Database Types

After running the schema, you can generate TypeScript types:

```bash
npx supabase gen types typescript --project-id atdlqhmggxkkwogxgrwy > types/database.types.ts
```

Or manually define them in your project based on the schema above.
