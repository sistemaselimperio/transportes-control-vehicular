"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/** Opens the print dialog once when the voucher loads; the button prints it again. Hidden on paper. */
export function VoucherPrintBar({ title }: { title: string }) {
  const printed = useRef(false);

  useEffect(() => {
    if (printed.current) return;
    printed.current = true;
    window.print();
  }, []);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 print:hidden">
      <p className="text-sm font-medium">{title}</p>
      <Button type="button" className="h-11 px-4 md:h-10" onClick={() => window.print()}>
        <Printer aria-hidden />
        Imprimir comprobante
      </Button>
    </div>
  );
}
