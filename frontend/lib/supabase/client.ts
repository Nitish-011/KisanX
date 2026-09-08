import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

export async function logAccessToken() {
  // Security Hardening: Never log raw JWTs to console in production
  if (process.env.NODE_ENV !== "development") return;

  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return;
  }

  // Log only sanitized fingerprint to prevent token exfiltration
  const token = data.session.access_token;
  const redacted = token ? `${token.slice(0, 10)}...${token.slice(-6)}` : "None";
  console.debug("[KisanX Security Audit] Active session verified. Token signature:", redacted);
}
