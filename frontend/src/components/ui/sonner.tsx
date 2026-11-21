"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toast feedback, themed from the brand tokens. Call `toast()` from "sonner" anywhere in the app. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-line !bg-card !text-ink !font-sans !shadow-[0_8px_24px_-12px_rgb(42_43_36/0.25)]",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          closeButton: "!bg-card !border-line",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
