import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.GESTPYME_CONFIG ?? {};
const ready = Boolean(config.supabaseUrl && config.supabasePublishableKey);

export const supabase = ready
  ? createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export const supabaseConfigured = ready;
