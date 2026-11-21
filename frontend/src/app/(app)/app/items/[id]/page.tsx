import type { Metadata } from "next";

import { ItemDetail } from "./item-detail";

export const metadata: Metadata = { title: "Saved item" };

export default function ItemPage() {
  return <ItemDetail />;
}
