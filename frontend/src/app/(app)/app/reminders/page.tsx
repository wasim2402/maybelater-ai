import type { Metadata } from "next";

import { RemindersList } from "./reminders-list";

export const metadata: Metadata = { title: "Reminders" };

export default function RemindersPage() {
  return <RemindersList />;
}
