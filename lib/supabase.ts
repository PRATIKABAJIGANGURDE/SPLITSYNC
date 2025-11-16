import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://atdlqhmggxkkwogxgrwy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0ZGxxaG1nZ3hra3dvZ3hncnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTI2OTQsImV4cCI6MjA3ODg2ODY5NH0.X_knOcVmBIvFsdDuxqS0dZ6TZKhxfg_Rw0VFjEIGzxQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
