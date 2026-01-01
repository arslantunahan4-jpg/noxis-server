
import { createClient } from '@supabase/supabase-js';

// Configured with user-provided keys
const supabaseUrl = 'https://yqxzjrgbivvomijldwel.supabase.co';
// Note: This key format is unusual (normally 'ey...'). If auth fails, check Project Settings > API > anon public key.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeHpqcmdiaXZ2b21pamxkd2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMjYxMzMsImV4cCI6MjA4MTkwMjEzM30.EJHSy7Oe46Y1XiZP1krQ7zVlYDUcFYPbLks6OGIejsQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
