import type { Metadata } from "next";

import { SignUpModal } from "@/components/auth/signup-modal";

export const metadata: Metadata = {
  title: "Sign up",
  description:
    "Create your HOMECOURT sweepstakes account — sweepstakes credits, real-time order books, no brokers.",
};

export default function SignUpPage() {
  return <SignUpModal mode="signup" />;
}
