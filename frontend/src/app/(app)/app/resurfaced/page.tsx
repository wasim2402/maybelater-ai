import type { Metadata } from "next";

import { ResurfacedList } from "./resurfaced-list";

export const metadata: Metadata = { title: "Resurfaced" };

export default function ResurfacedPage() {
  return <ResurfacedList />;
}
