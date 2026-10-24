import { getLogbookPage } from "@/modules/logbook/application/logbook-queries";
import { parseLogbookQuery, parseTabParam } from "@/modules/logbook/domain/logbook";
import { LogbookView } from "@/modules/logbook/ui/logbook-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = parseTabParam(params.tab);
  const query = parseLogbookQuery(params);
  const page = await getLogbookPage(tab, query);
  return <LogbookView page={page} tab={tab} query={query} />;
}
