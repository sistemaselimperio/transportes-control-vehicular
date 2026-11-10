import Image from "next/image";
import { splitPlate } from "@/modules/vehicles/domain/plate";

/**
 * A plate's text with the company mark in place of its hyphen. The mark's alt text is the hyphen,
 * so screen readers and copied text still read "ABC-123".
 */
export function PlateText({ plate }: { plate: string }) {
  const parts = splitPlate(plate);
  if (!parts) return <>{plate}</>;
  return (
    <>
      {parts[0]}
      <Image
        src="/plate-mark.webp"
        alt="-"
        width={96}
        height={96}
        unoptimized
        className="mx-[0.2em] inline-block size-[calc(0.8em-3px)] shrink-0 align-middle"
      />
      {parts[1]}
    </>
  );
}
