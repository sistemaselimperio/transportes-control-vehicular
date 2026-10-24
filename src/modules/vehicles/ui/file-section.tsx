import type { ReactNode } from "react";

/** A register section: the heading row carries one bottom rule and the section's own actions. */
export function Section({
  id,
  title,
  note,
  actions,
  children,
}: {
  id?: string;
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {note && <span className="num text-sm text-muted-foreground">{note}</span>}
        {actions && <div className="max-md:order-last max-md:basis-full md:ml-auto">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Small heading for a list inside a section. */
export const SubHeading = ({ children, count }: { children: ReactNode; count: number }) => (
  <h3 className="mt-5 flex items-baseline gap-2 border-b pb-1.5 text-sm font-semibold">
    {children}
    <span className="num font-normal text-muted-foreground">{count}</span>
  </h3>
);
