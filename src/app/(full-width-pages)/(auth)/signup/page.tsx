import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sourcing Launch SignUp Page | Your Orders, Your Control — Welcome to Your Dashboard",
  description: "Your Orders, Your Control — Welcome to Your Dashboard",
  // other metadata
};

export default function SignUp() {
  console.log("Supabase config:", {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Not set"
  });
  return <SignUpForm />;
}
