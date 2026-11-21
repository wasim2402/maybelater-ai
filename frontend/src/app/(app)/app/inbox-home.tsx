"use client";

import { Inbox } from "lucide-react";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/state-views";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/account/api";

/** The signed-in home. Reads the account from the API (proving the session reaches FastAPI).
 *  Saving links and notes, and the list itself, arrive with the capture stage. */
export function InboxHome() {
  const me = useMe();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl sm:text-4xl">Inbox</h1>
      {me.isPending ? (
        <div className="mt-6">
          <ListSkeleton rows={2} label="Loading your account" />
        </div>
      ) : me.isError ? (
        <ErrorState
          className="mt-6"
          title="Your account did not load"
          action={
            <Button variant="outline" onClick={() => me.refetch()}>
              Try again
            </Button>
          }
        >
          {me.error.message}
        </ErrorState>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Signed in as {me.data.display_name || me.data.email}
          </p>
          <EmptyState icon={Inbox} title="Nothing saved yet" className="mt-6">
            Your account is ready. Saving links and notes is the next part we are building; they will
            appear here.
          </EmptyState>
        </>
      )}
    </div>
  );
}
