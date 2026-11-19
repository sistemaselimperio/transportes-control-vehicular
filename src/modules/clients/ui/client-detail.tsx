"use client";

import { Copy, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import type { ClientRow } from "../domain/client-row";
import { buildMapsLink, buildWhatsAppShareUrl } from "../domain/maps-link";

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 border-b py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "mt-0.5 text-sm font-medium break-words" : "mt-0.5 text-sm text-muted-foreground"}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

/** The client's data and the ways to hand its location to a driver. */
export function ClientDetail({ client }: { client: ClientRow }) {
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  const link = buildMapsLink(client);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied(null), 4000);
  }

  return (
    <div className="space-y-5">
      <dl>
        <Detail label="NIT" value={client.nit ? formatNit(client.nit) : null} />
        <Detail label="Teléfono" value={client.phone} />
        <Detail label="Dirección" value={client.address} />
        <Detail label="Notas" value={client.notes} />
        <Detail
          label="Entregas registradas"
          value={String(client.deliveryCount)}
        />
      </dl>

      <div className="space-y-2">
        <p className="micro-label">Ubicación</p>
        {link ? (
          <div className="flex flex-col gap-2">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ className: "h-11 justify-start px-4 md:h-10" })}
            >
              <MapPin aria-hidden />
              Ver en Maps
              <ExternalLink className="ml-auto size-3.5" aria-hidden />
            </a>
            <Button variant="outline" className="h-11 justify-start px-4 md:h-10" onClick={copyLink}>
              <Copy aria-hidden />
              Copiar link para conductor
            </Button>
            <a
              href={buildWhatsAppShareUrl({ name: client.name, address: client.address, link })}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", className: "h-11 justify-start px-4 md:h-10" })}
            >
              <MessageCircle aria-hidden />
              Compartir por WhatsApp
            </a>
            <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
              {copied === "done" && "Link copiado."}
              {copied === "failed" && "No se pudo copiar. Mantén presionado el link para copiarlo."}
            </p>
            {copied === "failed" && <p className="text-xs break-all text-muted-foreground">{link}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este cliente no tiene link de Maps. Edita el cliente y pega el link para poder compartirlo.
          </p>
        )}
      </div>
    </div>
  );
}
