import { describe, expect, it, vi } from "vitest";
import { planCoordinateBackfill } from "./coordinate-backfill";

const finca = (id: number, mapsUrl: string) => ({ id, name: `Finca ${id}`, clientName: "Cliente", mapsUrl });

describe("planCoordinateBackfill", () => {
  it("reads a long link offline, without expanding it", async () => {
    const expand = vi.fn();
    const plan = await planCoordinateBackfill([finca(1, "https://www.google.com/maps/search/5.5353,+-73.3678")], expand);
    expect(plan.updates).toEqual([
      expect.objectContaining({ id: 1, latitude: 5.5353, longitude: -73.3678, source: "parsed" }),
    ]);
    expect(expand).not.toHaveBeenCalled();
  });

  it("expands a short link and reads the link it expands to", async () => {
    const expand = vi.fn().mockResolvedValue("https://www.google.com/maps/search/5.551789,+-73.777044?entry=tts");
    const plan = await planCoordinateBackfill([finca(2, "https://maps.app.goo.gl/AbC123")], expand);
    expect(expand).toHaveBeenCalledWith("https://maps.app.goo.gl/AbC123");
    expect(plan.updates).toEqual([
      expect.objectContaining({ id: 2, latitude: 5.551789, longitude: -73.777044, source: "expanded" }),
    ]);
  });

  it("leaves unresolved the fincas whose link gives no coordinates", async () => {
    const expand = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("https://www.google.com/maps/search/Finca+X");
    const plan = await planCoordinateBackfill(
      [
        finca(3, "https://maps.app.goo.gl/Fails"),
        finca(4, "https://maps.app.goo.gl/NameOnly"),
        finca(5, "https://www.google.com/maps/place/Finca+Y"),
      ],
      expand,
    );
    expect(plan.updates).toEqual([]);
    expect(plan.unresolved.map((f) => f.id)).toEqual([3, 4, 5]);
  });
});
