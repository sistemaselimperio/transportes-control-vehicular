import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "../../../public/logo-imperio.webp";

/** The Transportes El Imperio logo. Size it by height; the width follows. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt="Transportes El Imperio"
      priority
      className={cn("h-9 w-auto shrink-0", className)}
    />
  );
}
