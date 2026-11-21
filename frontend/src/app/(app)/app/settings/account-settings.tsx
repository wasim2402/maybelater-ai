"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { ErrorState, ListSkeleton, SuccessNote } from "@/components/feedback/state-views";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMe, useUpdateMe, type Me } from "@/features/account/api";
import { clearApiToken } from "@/lib/api/token";
import { authClient } from "@/lib/auth/client";

export function AccountSettings() {
  const me = useMe();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl sm:text-4xl">Settings</h1>
      {me.isPending ? (
        <div className="mt-6">
          <ListSkeleton rows={2} label="Loading your settings" />
        </div>
      ) : me.isError ? (
        <ErrorState
          className="mt-6"
          title="Your settings did not load"
          action={
            <Button variant="outline" onClick={() => me.refetch()}>
              Try again
            </Button>
          }
        >
          {me.error.message}
        </ErrorState>
      ) : (
        <div className="mt-8 space-y-10">
          <ProfileForm me={me.data} />
          <SessionSection />
          <DeleteAccountSection />
        </div>
      )}
    </div>
  );
}

function timeZones(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return all.includes(current) ? all : [current, ...all];
}

function ProfileForm({ me }: { me: Me }) {
  const id = useId();
  const update = useUpdateMe();
  const [name, setName] = useState(me.display_name ?? "");
  const [zone, setZone] = useState(me.timezone);
  const [saved, setSaved] = useState(false);
  const zones = useMemo(() => timeZones(me.timezone), [me.timezone]);
  const browserZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const dirty = name !== (me.display_name ?? "") || zone !== me.timezone;

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-5">
      <div>
        <h2 id={`${id}-h`} className="text-xl">
          Account
        </h2>
        <p className="mt-1 text-[15px] text-muted-foreground">Signed in with {me.email}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(
            { display_name: name.trim(), timezone: zone },
            { onSuccess: () => setSaved(true) },
          );
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            Display name
          </label>
          <Input id={`${id}-name`} value={name} maxLength={120} autoComplete="name" onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-zone`} className="text-sm font-medium">
            Time zone
          </label>
          <select
            id={`${id}-zone`}
            value={zone}
            onChange={(e) => { setZone(e.target.value); setSaved(false); }}
            aria-describedby={`${id}-zone-hint`}
            className="h-12 w-full rounded-md border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <p id={`${id}-zone-hint`} className="text-[13px] text-muted-foreground">
            Reminders and “this weekend” follow this clock.
            {browserZone && browserZone !== zone ? (
              <>
                {" "}
                <button type="button" className="font-medium text-sage-deep underline underline-offset-4" onClick={() => { setZone(browserZone); setSaved(false); }}>
                  Use {browserZone.replaceAll("_", " ")}
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <div aria-live="polite">
            {saved ? <SuccessNote>Saved.</SuccessNote> : null}
            {update.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {update.error.message}
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
}

function SessionSection() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <section aria-labelledby="session-h" className="space-y-3 border-t border-line pt-8">
      <h2 id="session-h" className="text-xl">
        Session
      </h2>
      <p className="text-[15px] text-ink/85">Sign out on this device. Your saved items stay in your account.</p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await authClient.signOut();
          clearApiToken();
          router.replace("/login?reason=signed-out");
          router.refresh();
        }}
      >
        <LogOut aria-hidden /> {busy ? "Signing out…" : "Sign out"}
      </Button>
    </section>
  );
}

function DeleteAccountSection() {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteEverything() {
    setBusy(true);
    setError(null);
    try {
      // Better Auth checks the password, then (server-side hook) deletes the data in the API, then
      // removes the sign-in account. A wrong password or an API failure deletes nothing.
      const result = await authClient.deleteUser({ password });
      if (result.error) {
        setError(
          result.error.code === "INVALID_PASSWORD"
            ? "That password did not match. Nothing was deleted."
            : result.error.message || "Your account could not be deleted. Nothing was removed; try again.",
        );
        return;
      }
      clearApiToken();
      toast("Your account and everything in it were deleted.");
      router.replace("/");
    } catch {
      setError("Something went wrong. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="delete-h" className="space-y-3 border-t border-line pt-8">
      <h2 id="delete-h" className="text-xl">
        Delete account
      </h2>
      <p className="text-[15px] text-ink/85">
        Permanently deletes your account, every saved item, reminder and setting. This cannot be undone.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Delete my account
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setPassword("");
            setError(null);
          }
        }}
      >
        <DialogContent className="gap-5 p-6 sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-lg">Delete your account?</DialogTitle>
            <DialogDescription className="text-[15px] text-ink/85">
              Everything you saved will be removed for good. Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) void deleteEverything();
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor={`${id}-pw`} className="text-sm font-medium">
                Password
              </label>
              <Input
                id={`${id}-pw`}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-err` : undefined}
              />
              {error ? (
                <p id={`${id}-err`} role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2">
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" className="bg-destructive text-white hover:bg-destructive/90" disabled={!password || busy}>
                {busy ? "Deleting…" : "Delete everything"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
