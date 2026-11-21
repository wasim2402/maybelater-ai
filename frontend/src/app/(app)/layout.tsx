import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/theme/fonts";

import "../globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "MaybeLater", template: "%s · MaybeLater" },
  description: "Save links and thoughts for later, see why you saved them, and get them back when they matter.",
};

export const viewport: Viewport = {
  themeColor: "#f7f2eb",
};

/** Root layout for the product: auth screens, the app and the design-system reference. */
export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
