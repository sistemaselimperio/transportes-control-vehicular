import { PageHeader } from "@/components/app/page-header";

/** Placeholder for a section that is linked in the sidebar but not built yet. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />
      <div className="panel">
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Esta sección está en construcción.
        </p>
      </div>
    </div>
  );
}
