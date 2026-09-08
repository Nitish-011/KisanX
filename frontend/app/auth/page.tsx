"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthUI } from "@/components/ui/auth_ui";
import { createClient } from "@/lib/supabase/client";

type UserRole = "FARMER" | "BUYER" | "OFFICER";

function AuthContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [initialMessage, setInitialMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setInitialMessage("Registration successful! You can now log in with your credentials.");
    }
    const errorParam = searchParams.get("error");
    if (errorParam) {
      console.warn("Auth query notice:", errorParam);
    }
  }, [searchParams]);

  const redirectByRole = (role?: string | null) => {
    const cleanRole = (role || "FARMER").toUpperCase();
    let target = "/dashboard";
    if (cleanRole === "BUYER") {
      target = "/market?tab=buyer";
    } else if (
      cleanRole === "OFFICER" ||
      cleanRole === "EXPERT" ||
      cleanRole === "INSPECTOR"
    ) {
      target = "/market?tab=inspector";
    }
    // Use window.location.href to guarantee all session cookies are flushed
    // and transmitted to Next.js Server Components on initial request.
    window.location.href = target;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
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
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    let autoConfirmed = false;

    // 1. Try fast backend registration with auto-confirmed email (bypasses unconfirmed SMTP requirement)
    try {
      const regRes = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName,
          role,
        }),
      });

      if (regRes.ok) {
        autoConfirmed = true;
      }
    } catch (backendErr) {
      console.warn("Backend registration helper unavailable, falling back to Supabase client:", backendErr);
    }

    // 2. If backend auto-confirmed the account, log in immediately!
    if (autoConfirmed) {
      await signIn(email, password);
      return;
    }

    // 3. Fallback to client-side Supabase signUp
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
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
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        role,
      });
    } catch (upsertErr) {
      console.warn("Profiles table bypass notice:", upsertErr);
    }

    if (data.session) {
      redirectByRole(role);
    } else {
      // Attempt immediate sign in in case project auto-confirms
      try {
        await signIn(email, password);
      } catch {
        window.location.href = "/auth?registered=true";
      }
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
      initialMessage={initialMessage}
      onSignIn={signIn}
      onSignUp={signUp}
      onGoogleSignIn={googleSignIn}
      onDemoSignIn={demoSignIn}
    />
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030604] flex items-center justify-center text-white/50 text-xs font-mono">Loading authentication...</div>}>
      <AuthContent />
    </Suspense>
  );
}
