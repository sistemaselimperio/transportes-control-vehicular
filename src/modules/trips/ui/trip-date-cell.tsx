import { formatTripDateTime } from "../domain/trip-datetime";

/** Date on top and the time under it, smaller and muted: the same cell as the Preoperacionales list. */
export function TripDateCell({ startAt }: { startAt: string }) {
  const [date, time] = formatTripDateTime(startAt).split(" ");
  return (
    <>
      <span className="block">{date}</span>
      <span className="block text-xs text-muted-foreground">{time}</span>
    </>
  );
}
