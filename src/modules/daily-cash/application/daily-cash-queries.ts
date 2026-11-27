/**
 * Reads of the daily cash boxes. Never cached and never shared: every read re-checks that the
 * session user has the daily-cash flag and is scoped to that user's own boxes. The carried balances
 * are derived on every read, so editing an older box flows to the later ones.
 */
import { requireDailyCash } from "@/lib/session";
import { computeBoxChain, type BoxFigures } from "../domain/box-balances";
import { canCloseBox, previousBox } from "../domain/box-rules";
import type { BoxSheet } from "../domain/daily-cash-rows";
import { loadBoxContents, loadBoxInputs } from "../infrastructure/daily-cash-repository";

/** Every box of the session user in chronological order, with its derived figures. */
export async function listBoxFigures(): Promise<BoxFigures[]> {
  const session = await requireDailyCash();
  return computeBoxChain(await loadBoxInputs(session.user.id));
}

/** One box of the session user with its entries and arqueo; null when it does not exist. */
export async function getBoxSheet(id: number): Promise<BoxSheet | null> {
  const session = await requireDailyCash();
  const [inputs, contents] = await Promise.all([loadBoxInputs(session.user.id), loadBoxContents(session.user.id, id)]);
  if (!contents) return null;
  const chain = computeBoxChain(inputs);
  const figures = chain.find((b) => b.id === id);
  const input = inputs.find((b) => b.id === id);
  if (!figures || !input) return null;
  const previous = previousBox(chain, id);
  return {
    figures,
    isFirst: previous === null,
    openingBalance: input.openingBalance,
    closeBlockedBy: canCloseBox(chain, id) || previous === null ? null : previous.date,
    entries: contents.entries,
    counts: contents.counts,
  };
}
