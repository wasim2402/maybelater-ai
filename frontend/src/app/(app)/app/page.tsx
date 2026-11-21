import type { Metadata } from "next";

import { InboxHome } from "./inbox-home";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return <InboxHome />;
}
