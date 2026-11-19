import { describe, expect, it } from "vitest";
import { buildMapsLink, buildWhatsAppShareUrl, isHttpUrl, parseMapsCoordinates } from "./maps-link";

describe("parseMapsCoordinates", () => {
  it("reads the viewport after @", () => {
    expect(parseMapsCoordinates("https://www.google.com/maps/place/Casa/@5.5353,-73.3678,17z/data=!4m6")).toEqual({
      latitude: 5.5353,
      longitude: -73.3678,
    });
  });

  it("reads ?q=lat,lng", () => {
    expect(parseMapsCoordinates("https://maps.google.com/?q=5.5353,-73.3678")).toEqual({
      latitude: 5.5353,
      longitude: -73.3678,
    });
  });

  it("reads query=lat,lng (the search api link)", () => {
    expect(parseMapsCoordinates("https://www.google.com/maps/search/?api=1&query=5.5353%2C-73.3678")).toEqual({
      latitude: 5.5353,
      longitude: -73.3678,
    });
    expect(parseMapsCoordinates("https://www.google.com/maps/search/?api=1&query=5.5353,-73.3678")).toEqual({
      latitude: 5.5353,
      longitude: -73.3678,
    });
  });

  it("reads the pin in !3d!4d and prefers it over the viewport", () => {
    const url = "https://www.google.com/maps/place/Casa/@5.5000,-73.3000,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d5.5353!4d-73.3678";
    expect(parseMapsCoordinates(url)).toEqual({ latitude: 5.5353, longitude: -73.3678 });
  });

  it("accepts positive longitudes and integer coordinates", () => {
    expect(parseMapsCoordinates("https://x.test/maps/@-12,34.5,10z")).toEqual({ latitude: -12, longitude: 34.5 });
  });

  it("cannot read a short link offline", () => {
    expect(parseMapsCoordinates("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
    expect(parseMapsCoordinates("https://goo.gl/maps/AbCdEf123")).toBeNull();
  });

  it("rejects out-of-range coordinates and plain text", () => {
    expect(parseMapsCoordinates("https://x.test/maps/@95.0,-73.3,10z")).toBeNull();
    expect(parseMapsCoordinates("https://x.test/maps/@5.0,-190.3,10z")).toBeNull();
    expect(parseMapsCoordinates("")).toBeNull();
    expect(parseMapsCoordinates("calle 5 # 3-20")).toBeNull();
  });
});

describe("buildMapsLink", () => {
  it("builds the search link from the coordinates", () => {
    expect(buildMapsLink({ latitude: 5.5353, longitude: -73.3678, mapsUrl: "https://maps.app.goo.gl/x" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=5.5353,-73.3678",
    );
  });

  it("falls back to the pasted link", () => {
    expect(buildMapsLink({ latitude: null, longitude: null, mapsUrl: "https://maps.app.goo.gl/x" })).toBe(
      "https://maps.app.goo.gl/x",
    );
  });

  it("is null without coordinates or link", () => {
    expect(buildMapsLink({ latitude: null, longitude: null, mapsUrl: null })).toBeNull();
    expect(buildMapsLink({ latitude: 5.5, longitude: null, mapsUrl: null })).toBeNull();
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("encodes the name, address and link", () => {
    const url = buildWhatsAppShareUrl({ name: "Agro Ñandú", address: "Vereda La Y", link: "https://x.test/a?b=1&c=2" });
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(url.slice("https://wa.me/?text=".length));
    expect(text).toBe("Agro Ñandú\nVereda La Y\nhttps://x.test/a?b=1&c=2");
  });

  it("skips what is missing", () => {
    const url = buildWhatsAppShareUrl({ name: "Agro", address: null, link: null });
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("Agro");
  });
});

describe("isHttpUrl", () => {
  it("accepts only http and https links", () => {
    expect(isHttpUrl("https://maps.app.goo.gl/x")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("maps.app.goo.gl/x")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});
