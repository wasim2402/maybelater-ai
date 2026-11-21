import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/features/auth/auth-form";
import { AuthLayout } from "@/features/auth/auth-layout";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <AuthLayout
      title="Start your MaybeLater list"
      lead="Save links and thoughts now. We keep why you saved them and bring them back when you choose."
    >
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthLayout>
  );
}
