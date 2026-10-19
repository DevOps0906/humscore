import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; body: ReactNode };

export function LegalPage({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  intro?: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10 text-ink md:pt-14">
      <header className="border-b border-line pb-6">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">시행일: {effectiveDate}</p>
        {intro && <div className="mt-4 text-[15px] leading-7 text-ink-soft">{intro}</div>}
      </header>

      <nav aria-label="목차" className="my-8 rounded-2xl border border-line p-5">
        <p className="text-sm font-semibold">목차</p>
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-ink-soft sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="break-keep hover:text-accent hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-10">
        {sections.map((s) => (
          <section key={s.id} aria-labelledby={s.id}>
            <h2 id={s.id} className="scroll-mt-20 break-keep text-xl font-semibold tracking-tight">
              {s.title}
            </h2>
            <div className="mt-3 flex flex-col gap-3 break-words text-[15px] leading-7 text-ink-soft">{s.body}</div>
          </section>
        ))}
      </div>
    </main>
  );
}

export function Ol({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5 marker:text-ink-soft">{children}</ol>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-ink-soft">{children}</ul>;
}

export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead className="text-ink">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-line px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className="border-b border-line px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
