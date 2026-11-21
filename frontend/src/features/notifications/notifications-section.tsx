"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { BellRing, Volume2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUpdateMe, type Me } from "@/features/account/api";

import { useDisablePush, useEnablePush, usePushStatus, useRemoveDevice, useSendTestPush } from "./api";
import { playChime, unlockAudio } from "./chime";
import { currentSubscription, notificationPermission, pushSupport } from "./push";

const thisDeviceKey = ["notifications", "this-device"] as const;

/** Settings: system notifications for reminders on this device, the in-app chime, and other devices. */
export function NotificationsSection({ me }: { me: Me }) {
  const id = useId();
  const queryClient = useQueryClient();
  const status = usePushStatus();
  const enable = useEnablePush();
  const disable = useDisablePush();
  const test = useSendTestPush();
  const remove = useRemoveDevice();
  const update = useUpdateMe();
  const [sound, setSound] = useState(me.preferences.reminders.sound);

  // Read in the browser only (service workers and permissions don't exist on the server).
  const device = useQuery({
    queryKey: thisDeviceKey,
    queryFn: async () => ({ support: pushSupport(), permission: notificationPermission(), subscribed: Boolean(await currentSubscription()) }),
    staleTime: 0,
  });
  const refreshDevice = () => void queryClient.invalidateQueries({ queryKey: thisDeviceKey });
  const busy = enable.isPending || disable.isPending;
  const fail = (e: Error) => toast.error(e.message);

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-4 border-t border-line pt-8">
      <div>
        <h2 id={`${id}-h`} className="text-xl">
          Notifications
        </h2>
        <p className="mt-1 text-[15px] text-ink/85">
          Get a notification with a sound when a reminder is due, even when MaybeLater is closed. Quiet hours and &ldquo;Show my
          reminders&rdquo; apply to notifications too.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-card p-4" aria-live="polite">
        <p className="inline-flex items-center gap-2 text-[15px] font-medium">
          <BellRing aria-hidden className="size-4 text-sage-deep" /> This device
        </p>
        {status.isPending || device.isPending ? (
          <div aria-hidden className="h-10 animate-pulse rounded-md bg-muted" />
        ) : status.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Notification settings did not load. {status.error.message}
          </p>
        ) : !status.data.available || !status.data.public_key ? (
          <p className="text-[15px] text-muted-foreground">Notifications aren&apos;t set up on this server yet. Reminders still appear in the app.</p>
        ) : device.data?.support === "needs-install" ? (
          <p className="text-[15px]">
            On iPhone and iPad, add MaybeLater to your Home Screen first (Share, then <strong className="font-medium">Add to Home Screen</strong>), open it
            from there, and turn notifications on.
          </p>
        ) : device.data?.support === "unsupported" ? (
          <p className="text-[15px] text-muted-foreground">This browser can&apos;t show notifications. Reminders still appear in the app.</p>
        ) : device.data?.permission === "denied" ? (
          <p className="text-[15px]">
            Notifications are blocked for this site. Allow them in your browser&apos;s site settings (the icon next to the address), then come back
            here.
          </p>
        ) : device.data?.subscribed ? (
          <div className="space-y-3">
            <p className="text-[15px]">On. Reminders will show up as notifications on this device.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={test.isPending}
                onClick={() =>
                  test.mutate(undefined, {
                    onSuccess: ({ sent }) => toast(sent ? "Test notification sent." : "No device accepted it. Try turning notifications off and on."),
                    onError: fail,
                  })
                }
              >
                Send a test notification
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => disable.mutate(undefined, { onSuccess: () => toast("Notifications off on this device."), onError: fail, onSettled: refreshDevice })}
              >
                Turn off on this device
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[15px] text-ink/85">Off on this device. Your browser will ask for permission.</p>
            <Button
              disabled={busy}
              onClick={() =>
                enable.mutate(status.data.public_key!, { onSuccess: () => toast("Notifications on."), onError: fail, onSettled: refreshDevice })
              }
            >
              {enable.isPending ? "Turning on…" : "Turn on notifications"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => {
              const next = e.target.checked;
              setSound(next);
              update.mutate(
                { preferences: { ...me.preferences, reminders: { ...me.preferences.reminders, sound: next } } },
                { onError: (err) => (setSound(!next), fail(err)) },
              );
            }}
            className="mt-1 size-4 accent-[var(--brand-sage-deep)]"
          />
          <span>
            <span className="block text-[15px] font-medium">Play a chime in the app</span>
            <span className="block text-[13px] text-muted-foreground">When MaybeLater is open and a reminder comes due. Closed, your device plays its own notification sound.</span>
          </span>
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            unlockAudio();
            // resume() is asynchronous; give it a moment on the first press.
            setTimeout(() => playChime() || toast("Sound is blocked in this browser right now."), 60);
          }}
        >
          <Volume2 aria-hidden /> Play sound
        </Button>
      </div>

      {status.data && status.data.devices.length ? (
        <div>
          <h3 className="text-[15px] font-medium tracking-normal">Devices with notifications on</h3>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-card" aria-label="Devices with notifications on">
            {status.data.devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">{d.label ?? "A browser"}</p>
                  <p className="text-[13px] text-muted-foreground">Added {format(parseISO(d.created_at), "d MMM yyyy")}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  aria-label={`Remove ${d.label ?? "this browser"}`}
                  onClick={() => remove.mutate(d.id, { onSuccess: () => toast("Device removed."), onError: fail, onSettled: refreshDevice })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
