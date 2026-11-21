import type { Metadata } from "next";

import { AuthForm } from "@/features/auth/auth-form";
import { AuthLayout } from "@/features/auth/auth-layout";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthLayout title="Sign in to MaybeLater" lead="Your saved links and thoughts are where you left them.">
      <AuthForm mode="login" />
    </AuthLayout>
  );
}
