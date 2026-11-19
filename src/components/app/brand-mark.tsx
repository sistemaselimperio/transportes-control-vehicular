import Image from "next/image";
import type { BrandVariant } from "@/components/app/brand";
import { cn } from "@/lib/utils";
import logoImperio from "../../../public/logo-imperio.webp";
import logoLogistics from "../../../public/logo-logistica.webp";

const LOGOS = {
  imperio: { src: logoImperio, alt: "Transportes El Imperio", className: "" },
  // A square illustration, not a cut-out mark: rounded so its corners do not look clipped.
  logistics: { src: logoLogistics, alt: "Logística Ganadera", className: "rounded-xl" },
} as const;

/**
 * The brand logo: Transportes El Imperio by default, Logística Ganadera for the commercial area.
 * Size it by height; the width follows. Pass `decorative` when the name is already written next to it.
 */
export function BrandMark({
  className,
  decorative,
  variant = "imperio",
}: {
  className?: string;
  decorative?: boolean;
  variant?: BrandVariant;
}) {
  const logo = LOGOS[variant];
  return (
    <Image
      src={logo.src}
      alt={decorative ? "" : logo.alt}
      priority
      className={cn("h-20 w-auto shrink-0", logo.className, className)}
    />
  );
}
