"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearApiToken } from "@/lib/api/token";
import { authClient } from "@/lib/auth/client";

const email = z.string().trim().min(1, "Write your email address.").email("Write an email address with an @, like name@example.com.");

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Write your password."),
});

const signupSchema = z.object({
  name: z.string().trim().min(1, "Write the name you want us to use.").max(80, "Keep your name under 80 characters."),
  email,
  password: z
    .string()
    .min(10, "Use at least 10 characters for your password.")
    .max(128, "Keep your password under 128 characters."),
});

type Mode = "login" | "signup";
type Values = { name?: string; email: string; password: string };

/** Only same-site paths: `next` comes from the URL and must never send someone to another site. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/app";
}

const NOTICES: Record<string, string> = {
  expired: "Your session ended. Sign in again to carry on.",
  "signed-out": "You are signed out.",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const notice = mode === "login" ? NOTICES[params.get("reason") ?? ""] : undefined;
  const [status, setStatus] = useState<string | null>(null);
  const schema = mode === "signup" ? signupSchema : loginSchema;

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) as unknown as Resolver<Values>, shouldFocusError: true });

  const submit = handleSubmit(
    async (values) => {
      setStatus(null);
      const result =
        mode === "signup"
          ? await authClient.signUp.email({ name: values.name ?? "", email: values.email, password: values.password })
          : await authClient.signIn.email({ email: values.email, password: values.password });

      if (result.error) {
        // Deliberately vague: never confirm whether an email has an account.
        const tooMany = result.error.status === 429;
        setStatus(
          tooMany
            ? "Too many attempts. Wait a minute and try again."
            : mode === "login"
              ? "That email and password did not match. Try again."
              : "We could not create an account with those details. If you already have one, sign in instead.",
        );
        setFocus(mode === "login" ? "password" : "email");
        return;
      }
      clearApiToken();
      router.replace(next);
      router.refresh();
    },
    (errs) => setStatus(`${Object.keys(errs).length} ${Object.keys(errs).length === 1 ? "field needs" : "fields need"} attention.`),
  );

  const field = (name: keyof Values, label: string, props: React.ComponentProps<typeof Input>) => {
    const error = errors[name]?.message;
    return (
      <div className="space-y-1.5">
        <label htmlFor={`${id}-${name}`} className="text-sm font-medium">
          {label}
        </label>
        <Input
          id={`${id}-${name}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-${name}-error` : undefined}
          {...props}
          {...register(name)}
        />
        {error ? (
          <p id={`${id}-${name}-error`} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {notice ? (
        <p role="status" className="rounded-md bg-beige px-3.5 py-2.5 text-[15px]">
          {notice}
        </p>
      ) : null}
      {mode === "signup" ? field("name", "Name", { autoComplete: "name" }) : null}
      {field("email", "Email", { type: "email", autoComplete: "email", inputMode: "email" })}
      {field("password", "Password", {
        type: "password",
        autoComplete: mode === "signup" ? "new-password" : "current-password",
      })}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "One moment…" : mode === "signup" ? "Create my account" : "Sign in"}
      </Button>
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink/85">
        {status}
      </p>
      <p className="text-[15px] text-muted-foreground">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href={`/login${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-sage-deep underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to MaybeLater?{" "}
            <Link href={`/signup${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-sage-deep underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
