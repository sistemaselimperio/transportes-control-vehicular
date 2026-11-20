"use client";

import { CheckCircle2, ExternalLink, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Field } from "@/components/app/action-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createLocationAction, updateLocationAction } from "../application/client-actions";
import { LOCATION_NAME_MAX } from "../application/client-schemas";
import type { ClientLocationRow } from "../domain/client-location";
import { buildMapsEmbedUrl, classifyMapsLink, type MapsLinkCheck } from "../domain/maps-link";
import { InlineForm } from "./inline-form";

const FIELD = "h-10 md:h-9";

const TONE = {
  ok: "text-ok-foreground",
  neutral: "text-muted-foreground",
  warn: "text-warn-foreground",
} as const;

function describeLink(check: MapsLinkCheck): { tone: keyof typeof TONE; text: string; icon: LucideIcon } | null {
  switch (check.kind) {
    case "empty":
      return null;
    case "coordinates":
      return { tone: "ok", text: "Coordenadas detectadas", icon: CheckCircle2 };
    case "short":
      return { tone: "neutral", text: "Link corto: se usará tal cual", icon: Info };
    case "maps":
      return { tone: "neutral", text: "Link de Maps sin coordenadas: se usará tal cual", icon: Info };
    case "invalid":
      return { tone: "warn", text: "Esto no parece un link de Google Maps", icon: TriangleAlert };
  }
}

/** Adds a finca to the client, or edits `location`, in place inside the finca list. */
export function LocationForm({
  clientId,
  location,
  onDone,
  onCancel,
}: {
  clientId: number;
  location?: ClientLocationRow;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [mapsUrl, setMapsUrl] = useState(location?.mapsUrl ?? "");
  const check = classifyMapsLink(mapsUrl);
  const feedback = describeLink(check);
  const canTest = check.kind !== "empty" && check.kind !== "invalid";
  // Wait a frame so the sheet's own focus handling does not take focus back.
  useEffect(() => {
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <InlineForm
      action={(fd) => (location ? updateLocationAction(location.id, fd) : createLocationAction(clientId, fd))}
      submitLabel={location ? "Guardar cambios" : "Agregar finca"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Nombre de la finca" htmlFor={`${id}-name`} required>
        <Input
          ref={nameRef}
          id={`${id}-name`}
          name="name"
          className={FIELD}
          defaultValue={location?.name ?? ""}
          maxLength={LOCATION_NAME_MAX}
          autoComplete="off"
          required
        />
      </Field>
      <Field label="Dirección" htmlFor={`${id}-address`} hint="Opcional">
        <Input
          id={`${id}-address`}
          name="address"
          className={FIELD}
          defaultValue={location?.address ?? ""}
          autoComplete="off"
        />
      </Field>
      <Field
        label="Link de Google Maps"
        htmlFor={`${id}-maps`}
        hint="Pega el link desde Maps. Si trae coordenadas, se usan para armar el link del conductor."
      >
        <div className="flex gap-2">
          <Input
            id={`${id}-maps`}
            name="mapsUrl"
            type="url"
            inputMode="url"
            className={cn(FIELD, "min-w-0 flex-1")}
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            aria-describedby={`${id}-maps-check`}
            placeholder="https://maps.app.goo.gl/…"
            autoComplete="off"
          />
          {canTest ? (
            <a
              href={mapsUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", className: "h-10 px-3 md:h-9" })}
            >
              Probar
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          ) : (
            <Button type="button" variant="outline" className="h-10 px-3 md:h-9" disabled>
              Probar
            </Button>
          )}
        </div>
        <p id={`${id}-maps-check`} aria-live="polite" className="empty:hidden">
          {feedback && (
            <span className={cn("flex items-center gap-1.5 text-sm", TONE[feedback.tone])}>
              <feedback.icon className="size-4 shrink-0" aria-hidden />
              {feedback.text}
            </span>
          )}
        </p>
        {/* Only links with coordinates can be previewed: Maps pages refuse to load inside an iframe. */}
        {check.kind === "coordinates" && (
          // Google draws an "Abrir en Maps" card in the top-left corner that cannot be styled from here
          // (cross-origin), so the frame is taller than the box and pulled up to crop it out.
          <div className="mt-2 h-56 w-full overflow-hidden rounded-md border">
            <iframe
              key={`${check.lat},${check.lng}`}
              title="Vista previa del mapa de la finca"
              src={buildMapsEmbedUrl({ latitude: check.lat, longitude: check.lng })}
              className="-mt-16 h-[calc(100%+4rem)] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </Field>
    </InlineForm>
  );
}
