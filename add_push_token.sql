-- Add expo_push_token column to users table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'expo_push_token') THEN
        ALTER TABLE users ADD COLUMN expo_push_token TEXT;
    END IF;
END $$;
