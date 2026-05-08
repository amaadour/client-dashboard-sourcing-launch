import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sourcing Launch SignIn Page | Your Orders, Your Control — Welcome to Your Dashboard",
  description: "Your Orders, Your Control — Welcome to Your Dashboard",
};

export default function SignIn() {
  // Log Supabase config for debugging
  console.log("Supabase config (signin page):", {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Not set"
  });
  
  return <SignInForm />;
}
