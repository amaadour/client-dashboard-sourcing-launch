"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Handles the redirect back from Google (and any other OAuth provider).
// The Supabase client is configured with detectSessionInUrl: true, so the
// access token in the URL hash is parsed automatically on load. We just wait
// for the session to be available, then route the user to the right place.
export default function AuthCallback() {
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let finished = false;

    const routeUser = async (userId: string) => {
      if (finished) return;
      finished = true;

      try {
        // Check whether the account has been approved yet.
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("approve")
          .eq("id", userId)
          .single();

        if (!profileError && profile && profile.approve === false) {
          window.location.href = "/pending-approval";
          return;
        }
      } catch (err) {
        console.error("Error checking profile approval state:", err);
      }

      // Default destination once signed in.
      window.location.href = "/dashboard-home";
    };

    // If the session is already present (hash already processed), use it.
    const checkExistingSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await routeUser(data.session.user.id);
      }
    };

    // Otherwise wait for the SIGNED_IN event fired after the hash is parsed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          routeUser(session.user.id);
        }
      }
    );

    checkExistingSession();

    // Fallback: if no session shows up, send the user back to sign in.
    const timeout = setTimeout(() => {
      if (!finished) {
        setError("We couldn't complete the sign-in. Please try again.");
        setTimeout(() => {
          window.location.href = "/signin";
        }, 2500);
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
      {error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          <div className="w-10 h-10 border-4 border-gray-300 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-300">Signing you in…</p>
        </>
      )}
    </div>
  );
}
