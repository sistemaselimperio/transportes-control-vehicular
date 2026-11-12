"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Download, FileText, ImageOff, Loader2, Maximize, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_ZOOM, MIN_ZOOM, nextRotation, stepZoom, toggleZoom, zoomLabel, type Rotation } from "./viewer-zoom";

/** The private route that serves the attachment of one expense. */
export const attachmentUrl = (expenseId: number) => `/api/caja/gastos/${expenseId}`;

export type ViewedAttachment = { expenseId: number; name: string; mimeType: string };

type Size = { width: number; height: number };

const TOOL = "size-11 shrink-0 text-background hover:bg-background/15 hover:text-background focus-visible:ring-background/60 disabled:opacity-40";

/** Watches the size of an element (the stage the image is fitted into). */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * A photo the user can zoom (buttons, double tap, Ctrl + wheel, keys), pan (drag with the mouse,
 * native scroll on touch) and rotate. The image is laid out at its zoomed size, not transformed,
 * so the stage scrolls over all of it.
 */
function ImageStage({ src, name }: { src: string; name: string }) {
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const [natural, setNatural] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<Rotation>(0);
  // Where the view was centered (0..1 of the content) before a zoom, to keep that spot in view.
  const focus = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const turned = rotation === 90 || rotation === 270;
  const base = natural ? (turned ? { width: natural.height, height: natural.width } : natural) : null;
  // Fit inside the stage at 100 %; small photos are not blown up past their own size.
  const fit = base && stage.width > 0 ? Math.min(stage.width / base.width, stage.height / base.height, 1) : 1;
  const box = base ? { width: base.width * fit * zoom, height: base.height * fit * zoom } : null;
  const canPan = box !== null && (box.width > stage.width + 1 || box.height > stage.height + 1);

  const applyZoom = useCallback(
    (next: number) => {
      const el = stageRef.current;
      if (el && el.scrollWidth > 0) {
        focus.current = {
          x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
          y: (el.scrollTop + el.clientHeight / 2) / el.scrollHeight,
        };
      }
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
    },
    [stageRef],
  );

  useLayoutEffect(() => {
    const el = stageRef.current;
    const at = focus.current;
    if (!el || !at) return;
    focus.current = null;
    el.scrollLeft = at.x * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = at.y * el.scrollHeight - el.clientHeight / 2;
  }, [zoom, stageRef]);

  // Ctrl + wheel (and trackpad pinch, which browsers report the same way) zooms instead of the page.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      applyZoom(stepZoom(zoom, e.deltaY < 0 ? "in" : "out"));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom, stageRef, zoom]);

  const rotate = () => {
    setRotation((r) => nextRotation(r));
    setZoom(1);
  };

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "+" || e.key === "=") applyZoom(stepZoom(zoom, "in"));
    else if (e.key === "-") applyZoom(stepZoom(zoom, "out"));
    else if (e.key === "0") applyZoom(1);
    else if (e.key.toLowerCase() === "r") rotate();
    else return;
    e.preventDefault();
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // Touch already pans by scrolling; only the mouse needs drag-to-pan.
    if (e.pointerType !== "mouse" || e.button !== 0 || !canPan) return;
    const el = e.currentTarget;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    e.currentTarget.scrollLeft = start.left - (e.clientX - start.x);
    e.currentTarget.scrollTop = start.top - (e.clientY - start.y);
  }

  const endDrag = () => {
    drag.current = null;
  };

  const loading = natural === null && !failed;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-foreground text-background">
      <div
        ref={stageRef}
        role="region"
        aria-label={`${name}. Usa + y − para acercar, 0 para ajustar y R para rotar.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => applyZoom(toggleZoom(zoom))}
        className={cn(
          "relative flex min-h-0 flex-1 overflow-auto overscroll-contain outline-none select-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-background/50",
          canPan ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        )}
      >
        {box && (
          // `m-auto` centers the image while it is smaller than the stage and lets it scroll once it is larger.
          <div className="relative m-auto shrink-0" style={{ width: box.width, height: box.height }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- private file from our own route */}
            <img
              key={attempt}
              src={src}
              alt={`Adjunto: ${name}`}
              draggable={false}
              className="absolute top-1/2 left-1/2 max-w-none transition-transform duration-200 motion-reduce:transition-none"
              style={{
                width: turned ? box.height : box.width,
                height: turned ? box.width : box.height,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              }}
            />
          </div>
        )}
        {/* Hidden probe: learns the natural size before the image is laid out. */}
        {!box && !failed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`probe-${attempt}`}
            src={src}
            alt=""
            aria-hidden
            className="pointer-events-none absolute size-px opacity-0"
            onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            onError={() => setFailed(true)}
          />
        )}
        {loading && (
          <p role="status" className="m-auto flex items-center gap-2 text-sm text-background/80">
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
            Cargando imagen…
          </p>
        )}
        {failed && (
          <div role="alert" className="m-auto flex flex-col items-center gap-3 p-6 text-center text-sm">
            <ImageOff className="size-8 text-background/70" aria-hidden />
            No se pudo cargar la imagen.
            <Button
              variant="outline"
              className="h-11 border-background/40 bg-transparent px-4 text-background hover:bg-background/15 hover:text-background"
              onClick={() => {
                setFailed(false);
                setNatural(null);
                setAttempt((a) => a + 1);
              }}
            >
              Reintentar
            </Button>
          </div>
        )}
      </div>

      <div
        role="toolbar"
        aria-label="Controles de la imagen"
        className="flex shrink-0 items-center justify-center gap-1 border-t border-background/15 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <Button variant="ghost" size="icon" className={TOOL} aria-label="Alejar" title="Alejar (−)" disabled={!natural || zoom <= MIN_ZOOM} onClick={() => applyZoom(stepZoom(zoom, "out"))}>
          <ZoomOut aria-hidden />
        </Button>
        <Button
          variant="ghost"
          className={cn(TOOL, "w-auto min-w-20 px-2 text-sm tabular-nums")}
          aria-label={`Zoom ${zoomLabel(zoom)}. Ajustar a la pantalla`}
          title="Ajustar (0)"
          disabled={!natural}
          onClick={() => applyZoom(1)}
        >
          {zoomLabel(zoom)}
        </Button>
        <Button variant="ghost" size="icon" className={TOOL} aria-label="Acercar" title="Acercar (+)" disabled={!natural || zoom >= MAX_ZOOM} onClick={() => applyZoom(stepZoom(zoom, "in"))}>
          <ZoomIn aria-hidden />
        </Button>
        <span className="mx-1 h-6 w-px bg-background/20" aria-hidden />
        <Button variant="ghost" size="icon" className={TOOL} aria-label="Rotar a la derecha" title="Rotar (R)" disabled={!natural} onClick={rotate}>
          <RotateCw aria-hidden />
        </Button>
        <a
          href={src}
          download={name}
          aria-label={`Descargar ${name}`}
          title="Descargar"
          className={cn(
            "inline-flex items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-3 [&_svg]:size-4",
            TOOL,
          )}
        >
          <Download aria-hidden />
        </a>
      </div>
      <p aria-live="polite" className="sr-only">
        {natural ? `Zoom ${zoomLabel(zoom)}${rotation ? `, rotada ${rotation} grados` : ""}` : ""}
      </p>
    </div>
  );
}

/** A PDF in the browser's own viewer (which brings its own zoom and pages), plus a download. */
function PdfStage({ src, name }: { src: string; name: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted">
      <iframe src={src} title={`Adjunto: ${name}`} className="min-h-0 flex-1 border-0" />
      <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-card px-3 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{name}</span>
        </p>
        <a
          href={src}
          download={name}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
        >
          <Download className="size-4" aria-hidden />
          Descargar
        </a>
      </div>
    </div>
  );
}

/** The attachment itself: a zoomable photo or the PDF. Also used inside the review dialog. */
export function AttachmentBody({ attachment, className }: { attachment: ViewedAttachment; className?: string }) {
  const src = attachmentUrl(attachment.expenseId);
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {attachment.mimeType.startsWith("image/") ? (
        <ImageStage src={src} name={attachment.name} />
      ) : (
        <PdfStage src={src} name={attachment.name} />
      )}
    </div>
  );
}

/** Shows an attachment in a modal over the current screen, instead of opening a new tab. */
export function AttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: ViewedAttachment | null;
  onClose: () => void;
}) {
  const isImage = attachment?.mimeType.startsWith("image/") ?? false;
  return (
    <Dialog.Root open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-foreground/70 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-popover text-popover-foreground outline-none transition-[opacity,scale] duration-200 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none md:inset-6 md:rounded-2xl md:border md:shadow-soft lg:inset-x-[8vw]">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold tracking-tight">{attachment?.name ?? "Adjunto"}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {isImage ? "Foto de la factura · doble toque para acercar" : "PDF de la factura"}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Cerrar adjunto"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </header>
          {attachment && <AttachmentBody key={attachment.expenseId} attachment={attachment} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Opens the attachment of the expense full screen; a small helper for buttons next to a preview. */
export function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" className="h-11 px-3 text-xs md:h-9" onClick={onClick}>
      <Maximize aria-hidden />
      Pantalla completa
    </Button>
  );
}
