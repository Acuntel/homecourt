import type { Metadata } from "next";

import { LoginModal } from "@/components/auth/login-modal";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log back into HOMECOURT — sweepstakes credits, real-time order books, no brokers.",
};

export default function LoginPage() {
  return <LoginModal />;
}
