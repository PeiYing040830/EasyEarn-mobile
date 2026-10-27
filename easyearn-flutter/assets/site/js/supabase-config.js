/**
 * EasyEarn file note: Handles the supabase config page behavior and related user interactions.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl =
  window.EASYEARN_SUPABASE_URL ||
  "https://cxixbibfjvuxcdagbrho.supabase.co";

const supabaseAnonKey =
  window.EASYEARN_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4aXhiaWJmanZ1eGNkYWdicmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzEyNTMsImV4cCI6MjA5MDYwNzI1M30.NwhX4wVErNDEQ_tHhNkM422XJFfemfWK92OiCdxZDdA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Formats or checks Supabase configured so later code can use a clean value.
export const isSupabaseConfigured = () =>
  !supabaseUrl.includes("YOUR_PROJECT_ID") &&
  !supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY");

// Loads Supabase config status data so the page can display current information.
export function getSupabaseConfigStatus() {
  return {
    url: supabaseUrl,
    hasAnonKey: !supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY"),
    configured: isSupabaseConfigured()
  };
}
