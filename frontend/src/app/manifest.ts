import type { MetadataRoute } from "next";

/** Lets MaybeLater be installed to a home screen, which iPhone and iPad require for notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MaybeLater",
    short_name: "MaybeLater",
    description: "Save links and thoughts now; get back to them when you choose.",
    start_url: "/app",
    display: "standalone",
    background_color: "#F7F2EB",
    theme_color: "#8B9A6E",
    icons: [{ src: "/notification-icon.png", sizes: "192x192", type: "image/png", purpose: "any" }],
  };
}
