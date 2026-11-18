"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAILY_REPORT_FIRST_DATE } from "../domain/daily-report";
import { isIsoDate } from "../domain/preoperational-inspection";

/**
 * Date picker of the daily report page: each valid change updates `?fecha=` right away. Without
 * JavaScript it still submits as a plain GET form (press Enter).
 */
export function DailyReportDateForm({ date }: { date: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(date);
  const [synced, setSynced] = useState(date);
  // The URL is the source of truth: follow it when it changes (back button, "today").
  if (synced !== date) {
    setSynced(date);
    setValue(date);
  }

  return (
    <form method="get" action="/parte-diario" className="flex items-center gap-2" aria-busy={pending}>
      <Label htmlFor="daily-report-date" className="text-sm">
        Fecha
      </Label>
      <Input
        id="daily-report-date"
        type="date"
        name="fecha"
        value={value}
        min={DAILY_REPORT_FIRST_DATE}
        onChange={(e) => {
          setValue(e.target.value);
          if (isIsoDate(e.target.value)) {
            startTransition(() => router.replace(`/parte-diario?fecha=${e.target.value}`, { scroll: false }));
          }
        }}
        className="h-11 w-auto md:h-9"
      />
    </form>
  );
}
