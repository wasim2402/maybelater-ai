import Link from "next/link";

/** Two-column auth frame: the form on the left, a quiet reminder of what the product does on the right. */
export function AuthLayout({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <Link href="/" className="font-heading text-xl tracking-tight">
          MaybeLater
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 mb-8 text-[17px] text-ink/85">{lead}</p>
          {children}
        </main>
      </div>
      <aside aria-hidden className="hidden flex-col justify-end bg-beige p-12 lg:flex">
        <div className="max-w-md space-y-3 rounded-xl border border-line bg-card p-5">
          <p className="text-[13px] font-medium text-muted-foreground">Back for you this Saturday</p>
          <p className="text-lg font-medium">Sourdough starter guide</p>
          <p className="text-[15px] text-ink/85">You saved this to try a weekend bake with your sister.</p>
          <div className="flex gap-2 pt-1">
            <span className="inline-flex h-9 items-center rounded-md bg-sage px-3 text-sm font-medium text-on-sage">Open</span>
            <span className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm font-medium">Snooze a week</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
