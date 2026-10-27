import { revalidateTag, updateTag } from "next/cache";
import { changeTags, type Change } from "./cache-tags";

/** For Server Actions: expires the tags now, so the user's next render reads their own write. */
export function expireAfterAction(change: Change) {
  for (const tag of changeTags(change)) updateTag(tag);
}

/** For Route Handlers, where `updateTag` is not allowed: expires the tags immediately. */
export function expireAfterRoute(change: Change) {
  for (const tag of changeTags(change)) revalidateTag(tag, { expire: 0 });
}
