"use client";

import { useRouter } from "next/navigation";
import { AuthUI } from "@/components/ui/auth_ui";
import { createClient } from "@/lib/supabase/client";

type UserRole = "FARMER" | "BUYER" | "OFFICER";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const redirectByRole = (role?: string | null) => {
    const cleanRole = (role || "FARMER").toUpperCase();
    if (cleanRole === "BUYER") {
      router.push("/market?tab=buyer");
    } else if (
      cleanRole === "OFFICER" ||
      cleanRole === "EXPERT" ||
      cleanRole === "INSPECTOR"
    ) {
      router.push("/market?tab=inspector");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Resolve user's actual role
    let resolvedRole = "FARMER";
    if (data.user?.id) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.role) {
          resolvedRole = profile.role;
        } else if (data.user.user_metadata?.role) {
          resolvedRole = data.user.user_metadata.role;
        }
      } catch {
        resolvedRole = data.user.user_metadata?.role || "FARMER";
      }
    }

    redirectByRole(resolvedRole);
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Account could not be created.");
    }

    // Try client-side profile upsert
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        role,
      });

      // If client RLS restricted it (e.g. pending email confirmation), invoke backend service sync
      if (profileError) {
        console.warn("Client RLS notice, synchronizing profile via server-side service key:", profileError.message);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        await fetch(`${API_URL}/api/auth/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: data.user.id,
            full_name: fullName,
            role,
          }),
        }).catch((err) => console.error("Server sync warning:", err));
      }
    } catch (upsertErr) {
      console.warn("Profile will be auto-populated by database trigger on_auth_user_created:", upsertErr);
    }

    if (data.session) {
      redirectByRole(role);
    } else {
      router.push("/auth?registered=true");
      router.refresh();
    }
  };

  const googleSignIn = async () => {
    const origin = window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/confirm?next=/dashboard`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const demoSignIn = async (targetRole: UserRole) => {
    let email = "farmer@kisanx.com";
    const password = "Password123!";

    if (targetRole === "BUYER") {
      email = "buyer@kisanx.com";
    } else if (targetRole === "OFFICER") {
      email = "officer@kisanx.com";
    }

    await signIn(email, password);
  };

  return (
    <AuthUI
      onSignIn={signIn}
      onSignUp={signUp}
      onGoogleSignIn={googleSignIn}
      onDemoSignIn={demoSignIn}
    />
  );
}
