import { describe, expect, it } from "vitest";
import { buildMapsLink, buildWhatsAppShareUrl, classifyMapsLink, isHttpUrl, parseMapsCoordinates } from "./maps-link";

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
    expect(buildMapsLink({ latitude: null, longitude: null, mapsUrl: "https://maps.app.goo.gl/x", address: "Vereda La Y" })).toBe(
      "https://maps.app.goo.gl/x",
    );
  });

  it("searches by address when there is no coordinate or link", () => {
    expect(buildMapsLink({ latitude: null, longitude: null, mapsUrl: null, address: "Vereda La Y, Susa" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Vereda%20La%20Y%2C%20Susa",
    );
  });

  it("is null without coordinates, link or address", () => {
    expect(buildMapsLink({ latitude: null, longitude: null, mapsUrl: null, address: null })).toBeNull();
    expect(buildMapsLink({ latitude: 5.5, longitude: null, mapsUrl: null, address: " " })).toBeNull();
  });
});

describe("buildWhatsAppShareUrl", () => {
  const decode = (url: string) => decodeURIComponent(url.slice("https://wa.me/?text=".length));

  it("encodes the client, finca, address and link", () => {
    const url = buildWhatsAppShareUrl({
      clientName: "Agro Ñandú",
      locationName: "Finca 1",
      address: "Vereda La Y",
      link: "https://x.test/a?b=1&c=2",
    });
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decode(url)).toBe("Agro Ñandú\nFinca 1\nVereda La Y\nhttps://x.test/a?b=1&c=2");
  });

  it("skips what is missing", () => {
    const url = buildWhatsAppShareUrl({ clientName: "Agro", locationName: "Principal", address: null, link: null });
    expect(decode(url)).toBe("Agro\nPrincipal");
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

describe("classifyMapsLink", () => {
  it("is empty for blank text", () => {
    expect(classifyMapsLink("")).toEqual({ kind: "empty" });
    expect(classifyMapsLink("   ")).toEqual({ kind: "empty" });
  });

  it("reads coordinates from a full Google Maps link", () => {
    expect(classifyMapsLink("https://www.google.com/maps/place/Casa/@5.5353,-73.3678,17z")).toEqual({
      kind: "coordinates",
      lat: 5.5353,
      lng: -73.3678,
    });
    expect(classifyMapsLink("https://maps.google.com/?q=5.5353,-73.3678")).toEqual({
      kind: "coordinates",
      lat: 5.5353,
      lng: -73.3678,
    });
  });

  it("recognises short links, which hold no coordinates", () => {
    expect(classifyMapsLink("https://maps.app.goo.gl/AbC123")).toEqual({ kind: "short" });
    expect(classifyMapsLink("https://goo.gl/maps/AbC123")).toEqual({ kind: "short" });
  });

  it("accepts a Maps link without coordinates", () => {
    expect(classifyMapsLink("https://www.google.com/maps/place/Finca+La+Esperanza")).toEqual({ kind: "maps" });
    expect(classifyMapsLink("https://maps.google.com/?cid=123")).toEqual({ kind: "maps" });
  });

  it("flags anything that is not a Google Maps link", () => {
    expect(classifyMapsLink("hola")).toEqual({ kind: "invalid" });
    expect(classifyMapsLink("javascript:alert(1)")).toEqual({ kind: "invalid" });
    expect(classifyMapsLink("https://example.com/@5.5,-73.3,17z")).toEqual({ kind: "invalid" });
    expect(classifyMapsLink("https://www.google.com/search?q=finca")).toEqual({ kind: "invalid" });
  });

  it("ignores surrounding spaces", () => {
    expect(classifyMapsLink("  https://maps.app.goo.gl/AbC123 ")).toEqual({ kind: "short" });
  });
});
