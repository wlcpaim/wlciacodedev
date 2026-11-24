import { supabase } from "@/integrations/supabase/client";

/**
 * Links data imported from the previous WLC IA backend to the signed-in account.
 * The database only moves rows when the account's verified email uniquely matches
 * an imported user, so this is safe to call on every sign-in.
 */
export async function claimLegacyAccount(): Promise<void> {
  const { data, error } = await supabase.rpc("claim_legacy_account");
  if (error) {
    console.warn("[legacy-account] claim failed:", error.message);
    return;
  }
  const result = data as { claimed?: boolean } | null;
  if (result?.claimed) window.dispatchEvent(new CustomEvent("wlc-legacy-claimed"));
}
