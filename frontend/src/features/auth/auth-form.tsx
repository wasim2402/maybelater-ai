"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useId, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const email = z.string().trim().min(1, "Write your email address.").email("Write an email address with an @, like name@example.com.");

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Write your password."),
});

const signupSchema = z.object({
  name: z.string().trim().min(1, "Write the name you want us to use.").max(80, "Keep your name under 80 characters."),
  email,
  password: z.string().min(10, "Use at least 10 characters for your password."),
});

type Mode = "login" | "signup";
type Values = { name?: string; email: string; password: string };

interface AuthFormProps {
  mode: Mode;
  /**
   * Submits the credentials. Accounts are wired to Better Auth in stage 05;
   * until then the page passes nothing and the form says so instead of pretending.
   */
  onSubmit?: (values: Values) => Promise<void>;
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const id = useId();
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
      if (!onSubmit) {
        setStatus("Accounts are not open yet. We are still building sign-in, so nothing was sent.");
        return;
      }
      try {
        await onSubmit(values);
      } catch {
        setStatus(mode === "login" ? "That email and password did not match. Try again." : "We could not create the account. Try again.");
        setFocus("email");
      }
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
            <Link href="/login" className="font-medium text-sage-deep underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to MaybeLater?{" "}
            <Link href="/signup" className="font-medium text-sage-deep underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
