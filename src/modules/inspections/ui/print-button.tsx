"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser print dialog; "Save as PDF" is one of its destinations. */
export function PrintButton() {
  return (
    <Button type="button" className="h-11 px-4 md:h-10" onClick={() => window.print()}>
      <Printer aria-hidden />
      Imprimir / PDF
    </Button>
  );
}
