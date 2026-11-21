import type { Metadata, Viewport } from "next";

import { landingFontVariables } from "@/theme/fonts";

import "./marketing.css";

export const metadata: Metadata = {
  // TODO(stage 14): set metadataBase and the canonical URL once the production domain is known.
  title: "MaybeLater AI: the save-for-later app that remembers why",
  description:
    "Save links and thoughts in one place. MaybeLater keeps your original, suggests why you saved it and brings it back on the day you pick.",
  openGraph: {
    type: "website",
    title: "MaybeLater AI: the save-for-later app that remembers why",
    description: "Links and notes kept with the reason you saved them, back on the day you choose.",
    images: [{ url: "/share.jpg", width: 1440, height: 900, alt: "The MaybeLater landing page hero" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f2eb",
};

const KIT_STYLES = [
  "/assets/system.css",
  "/assets/ui/cards.css",
  "/assets/motion/motion.css",
  "/assets/layout/layout.css",
  "/assets/icons/icon.css",
  "/assets/ui/base.css",
  "/assets/ui/window/fragment.css",
  "/assets/ui/doc/fragment.css",
  "/assets/scenes/scenes.css",
  "/assets/scenes/product-assembles-into-its-action/scene.css",
];

/* Before first paint: the hero waits for the motion layer (700ms fallback); moments and the scene get
   their guards, so their finished state is styled before their modules load. */
const KIT_GUARD =
  "var d=document.documentElement;d.classList.add('m-enter','mo-js','sc-js');" +
  "setTimeout(function(){d.classList.add('m-enter-done')},700);" +
  "setTimeout(function(){d.classList.add('mo-safe','sc-safe')},2500);";

/**
 * Root layout for the public landing page. It is a separate root layout from the app, so the
 * Taste Skill kit's global CSS (public/assets) and the landing type never reach product screens.
 * The deal and the page plan are in the comment at the top of ./page.tsx. The kit runtime and Lenis are
 * mounted by the page itself (after its own markup has hydrated), not here: the layout hydrates first.
 */
export default function MarketingRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-type="software"
      data-radius="soft"
      data-ground="sage"
      data-buttons="tonal"
      data-motion=""
      className={landingFontVariables}
      suppressHydrationWarning
    >
      <head>
        <meta name="site-kind" content="software" />
        <meta name="page-type" content="software" />
        {KIT_STYLES.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <script dangerouslySetInnerHTML={{ __html: KIT_GUARD }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
