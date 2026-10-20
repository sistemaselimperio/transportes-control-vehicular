import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "../../../public/logo-imperio.webp";

/**
 * The Transportes El Imperio logo. Size it by height; the width follows.
 * Pass `decorative` when the company name is already written next to it.
 */
export function BrandMark({ className, decorative }: { className?: string; decorative?: boolean }) {
  return (
    <Image
      src={logo}
      alt={decorative ? "" : "Transportes El Imperio"}
      priority
      className={cn("h-9 w-auto shrink-0", className)}
    />
  );
}
