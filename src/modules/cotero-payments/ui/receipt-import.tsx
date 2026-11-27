"use client";

import { FileUp, HandCoins, Loader2, PencilLine, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/modules/documents/domain/vehicle-file-rules";
import { optimizeFile } from "@/modules/documents/ui/optimize-file";
import {
  checkReceiptNumbersAction,
  createReceiptsAction,
  discardUploadsAction,
  prepareUploadsAction,
} from "../application/cotero-actions";
import { canonicalName, coteroKey } from "../domain/cotero-identity";
import { normalizeReceiptNumber } from "../domain/receipt-number";
import { applyFleetMatch, matchReceiptFleet, type FleetCandidates } from "../domain/fleet-matching";
import {
  applyImportCotero,
  EMPTY_IMPORT_COTERO,
  findProfileByDocument,
  resolveImportCotero,
  type ImportCotero,
} from "../domain/import-cotero";
import { emptyDraft, type ReceiptDraft } from "../domain/receipt-rules";
import type { CoteroProfileRow } from "../domain/settlement-rows";
import type { Tariff } from "../domain/tariff";
import { reloadIfStaleDeployment } from "@/lib/stale-deployment";
import { renderForReading } from "./page-renditions";
import { ReceiptReview, type ReviewItem } from "./receipt-review";
import { useOnWindowFocus, type FleetControl } from "./use-fleet";

/** Uploads straight to storage: a scanned PDF is bigger than a server-action body may be. */
async function uploadToStorage(uploadUrl: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
  return res.ok;
}

type ReadResult = { ok: true; drafts: ReceiptDraft[] } | { ok: false; error: string };

/** Sends one page rendition to the reader; nothing is saved by this call. */
async function readPage(blob: Blob): Promise<ReadResult> {
  try {
    const res = await fetch("/api/pagos-coteros/leer", { method: "POST", body: blob, headers: { "Content-Type": "image/jpeg" } });
    const data = (await res.json().catch(() => null)) as { drafts?: ReceiptDraft[]; error?: string } | null;
    if (!res.ok || !data?.drafts) return { ok: false, error: data?.error ?? "No se pudo leer la hoja." };
    return { ok: true, drafts: data.drafts };
  } catch {
    return { ok: false, error: "No se pudo leer la hoja." };
  }
}

/** The item with its plates and driver matched against the fleet: near misses corrected, the rest left as read. */
function withFleetMatch(item: ReviewItem, fleet: FleetCandidates): ReviewItem {
  const { draft, corrected } = applyFleetMatch(item.draft, matchReceiptFleet(item.draft, fleet));
  return { ...item, draft, corrected: { ...item.corrected, ...corrected } };
}

const revoke = (items: readonly ReviewItem[]) => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));

/**
 * "Leer recibos" and "Agregar a mano": photos or PDFs are stored (one shrunk copy) and read by the AI
 * from a separate sharp rendition of each page; the result opens in the review screen. Nothing is saved
 * until the reviewer confirms there. One import is one cotero, whatever the number of files: the review
 * has a single cotero header that is forced onto every receipt. After saving, the reviewer may go on to
 * settle exactly those receipts (never done on its own).
 */
export function ReceiptImport({
  tariffs,
  profiles,
  today,
  fleet,
  onDone,
  onSettle,
}: {
  tariffs: readonly Tariff[];
  /** The registered coteros: a cédula that belongs to one brings its stored name. */
  profiles: readonly CoteroProfileRow[];
  /** The active fleet the plates and the driver of each receipt are matched against. */
  fleet: FleetControl;
  /** Colombia's current day: the date a receipt typed by hand starts with. */
  today: string;
  onDone: (message: string) => void;
  /** Opens the settlement of `coteroKey` with only `receiptIds` (the ones just saved) selected. */
  onSettle: (coteroKey: string, receiptIds: readonly number[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const keys = useRef(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [existing, setExisting] = useState<ReadonlySet<string>>(new Set());
  const [cotero, setCotero] = useState<ImportCotero>(EMPTY_IMPORT_COTERO);
  /** The receipts just saved, offered for settlement until dismissed. */
  const [saved, setSaved] = useState<{ coteroKey: string; ids: number[]; name: string } | null>(null);
  // The latest items for handlers and the unmount cleanup, which must not close over stale state.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const fleetRef = useRef(fleet.fleet);
  useEffect(() => {
    fleetRef.current = fleet.fleet;
  }, [fleet.fleet]);
  /** Every file stored during this review: the ones no saved receipt ends up using are discarded. */
  const uploadedRef = useRef<string[]>([]);

  // Page images live as object URLs: release them when the screen goes away.
  useEffect(() => () => revoke(itemsRef.current), []);

  const nextKey = () => keys.current++;

  /** Reads the fleet again (a driver was registered meanwhile) and matches the receipts under review once more. */
  async function refreshFleet() {
    const next = await fleet.refresh();
    if (next) setItems(itemsRef.current.map((item) => withFleetMatch(item, next)));
  }
  // Back from the drivers section (another tab): the new driver should be found without a click.
  useOnWindowFocus(open, () => void refreshFleet());

  const refreshExisting = useCallback(async (drafts: readonly ReceiptDraft[]) => {
    const numbers = drafts.map((d) => normalizeReceiptNumber(d.receiptNumber)).filter((n): n is string => n !== null);
    if (numbers.length === 0) return;
    const result = await checkReceiptNumbersAction(numbers);
    if (result.ok) setExisting((current) => new Set([...current, ...result.existing]));
  }, []);

  /** Closes the review. Cancelled: every file stored for it goes; saved: only the ones no receipt kept. */
  function close(saved: boolean) {
    const kept = new Set(saved ? itemsRef.current.flatMap((i) => (i.filePath ? [i.filePath] : [])) : []);
    const unused = uploadedRef.current.filter((path) => !kept.has(path));
    if (unused.length > 0) void discardUploadsAction(unused);
    uploadedRef.current = [];
    revoke(itemsRef.current);
    setItems([]);
    setNotes([]);
    setExisting(new Set());
    setCotero(EMPTY_IMPORT_COTERO);
    setOpen(false);
  }

  function startManual() {
    setError(null);
    setSaved(null);
    setCotero(EMPTY_IMPORT_COTERO);
    revoke(itemsRef.current);
    uploadedRef.current = [];
    setItems([{ key: nextKey(), draft: emptyDraft(today), filePath: null, pageNumber: null, preview: null, source: "A mano", corrected: {} }]);
    setNotes([]);
    setExisting(new Set());
    setOpen(true);
  }

  async function readFiles(files: File[]) {
    setError(null);
    setSaved(null);
    const found: ReviewItem[] = [];
    const problems: string[] = [];
    const uploaded: string[] = [];
    try {
      // Which files can be stored: the stored copy is the shrunk one, the AI reads another rendition.
      setProgress("Preparando los archivos…");
      const ready: Array<{ file: File; stored: File }> = [];
      for (const file of files) {
        if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
          problems.push(`${file.name}: solo se permiten PDF, JPG, PNG o WebP.`);
          continue;
        }
        const stored = await optimizeFile(file);
        if (stored.size > MAX_FILE_BYTES) {
          problems.push(`${file.name}: supera el límite de 4 MB incluso comprimido.`);
          continue;
        }
        ready.push({ file, stored });
      }
      if (ready.length === 0) {
        setError(problems.join(" ") || "No hay archivos para leer.");
        return;
      }

      const targets = await prepareUploadsAction(ready.map((r) => ({ kind: "receipt", mimeType: r.stored.type, size: r.stored.size })));
      if (!targets.ok) {
        setError(targets.error);
        return;
      }

      for (const [index, { file, stored }] of ready.entries()) {
        const target = targets.uploads[index];
        setProgress(`Subiendo ${file.name}…`);
        if (!(await uploadToStorage(target.uploadUrl, stored))) {
          problems.push(`${file.name}: no se pudo subir el archivo.`);
          continue;
        }
        uploaded.push(target.path);

        let pages;
        try {
          pages = await renderForReading(file);
        } catch (e) {
          problems.push(`${file.name}: ${e instanceof Error && e.message.startsWith("El PDF") ? e.message : "no se pudo abrir el archivo."}`);
          continue;
        }

        let readAny = false;
        for (const page of pages) {
          setProgress(`Leyendo ${file.name} · hoja ${page.page} de ${pages.length}…`);
          const result = await readPage(page.blob);
          const source = pages.length > 1 ? `${file.name} · hoja ${page.page}` : file.name;
          const preview = URL.createObjectURL(page.blob);
          if (!result.ok) {
            problems.push(`${source}: ${result.error} Complétalo a mano mirando la hoja.`);
            found.push({ key: nextKey(), draft: emptyDraft(today), filePath: target.path, pageNumber: page.page, preview, source, corrected: {} });
            readAny = true;
            continue;
          }
          if (result.drafts.length === 0) {
            problems.push(`${source}: no se encontraron recibos.`);
            URL.revokeObjectURL(preview);
            continue;
          }
          readAny = true;
          result.drafts.forEach((draft, n) => {
            // Each card owns its own object URL, so removing one never breaks the others of the same page.
            found.push({
              key: nextKey(),
              draft,
              filePath: target.path,
              pageNumber: page.page,
              preview: n === 0 ? preview : URL.createObjectURL(page.blob),
              source,
              corrected: {},
            });
          });
        }
        if (!readAny) {
          // Nothing of this file will be saved: its stored copy is not needed.
          void discardUploadsAction([target.path]);
          uploaded.pop();
        }
      }

      if (found.length === 0) {
        if (uploaded.length > 0) void discardUploadsAction(uploaded);
        setError(problems.join(" ") || "No se encontraron recibos en los archivos.");
        return;
      }

      setProgress("Comprobando números de recibo…");
      revoke(itemsRef.current);
      uploadedRef.current = uploaded;
      // What the AI read is matched with the fleet right away: near misses are corrected and badged.
      setItems(found.map((item) => withFleetMatch(item, fleetRef.current)));
      setNotes(problems);
      setExisting(new Set());
      // The cotero of the whole import comes from what was read, in file, page and receipt order.
      const resolved = resolveImportCotero(found.map((i) => i.draft), profiles);
      setCotero({ name: resolved.name, document: resolved.document });
      setOpen(true);
      await refreshExisting(found.map((i) => i.draft));
    } catch (e) {
      if (reloadIfStaleDeployment(e)) return;
      console.error("cotero receipt reading failed", e);
      if (uploaded.length > 0) void discardUploadsAction(uploaded);
      revoke(found);
      setError("No se pudieron leer los archivos. Revisa que no estén dañados e intenta de nuevo.");
    } finally {
      setProgress(null);
    }
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length > 0) void readFiles(files);
  };

  const busy = progress !== null;

  async function save(): Promise<string | null> {
    const result = await createReceiptsAction(
      itemsRef.current.map((i) => ({ ...applyImportCotero(i.draft, cotero), filePath: i.filePath, pageNumber: i.pageNumber })),
    );
    if (!result.ok) return result.error;
    const name = canonicalName(cotero.name);
    const key = coteroKey({ name, document: cotero.document });
    close(true);
    onDone(result.message);
    if (key !== null && result.ids.length > 0) setSaved({ coteroKey: key, ids: result.ids, name });
    return null;
  }

  // The review's "Actualizar sugerencias" also matches the receipts again, not only reloads the list.
  const reviewFleet: FleetControl = { ...fleet, refresh: async () => {
      await refreshFleet();
      return null;
    },
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={onPick}
      />
      <Button
        className="h-11 px-4 md:h-10"
        disabled={busy}
        onClick={() => input.current?.click()}
        title="La IA lee las fotos o los PDF y te muestra los recibos para revisarlos"
      >
        {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <FileUp aria-hidden />}
        Leer recibos
      </Button>
      <Button variant="outline" className="h-11 px-4 md:h-10" disabled={busy} onClick={startManual}>
        <PencilLine aria-hidden />
        Agregar a mano
      </Button>

      {progress && (
        <p
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-soft"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-brand motion-reduce:animate-none" aria-hidden />
          {progress}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive shadow-soft"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" aria-label="Cerrar aviso" className="-m-2 flex size-11 shrink-0 items-center justify-center" onClick={() => setError(null)}>
            <X className="size-4" aria-hidden />
          </button>
        </p>
      )}

      {saved && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-soft"
        >
          <span className="min-w-0 flex-1">
            {saved.ids.length === 1 ? "1 recibo guardado" : `${saved.ids.length} recibos guardados`} de {saved.name}.
          </span>
          <Button
            type="button"
            className="h-11 shrink-0 px-3 md:h-9"
            onClick={() => {
              onSettle(saved.coteroKey, saved.ids);
              setSaved(null);
            }}
          >
            <HandCoins aria-hidden />
            Liquidar estos recibos
          </Button>
          <button type="button" aria-label="Cerrar aviso" className="-m-2 flex size-11 shrink-0 items-center justify-center" onClick={() => setSaved(null)}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <ReceiptReview
        open={open}
        items={items}
        existingNumbers={existing}
        tariffs={tariffs}
        fleet={reviewFleet}
        notes={notes}
        cotero={cotero}
        coteroKnown={findProfileByDocument(cotero.document, profiles) !== null}
        onCoteroChange={setCotero}
        onChange={setItems}
        onAddManual={() =>
          setItems((current) => [...current, { key: nextKey(), draft: emptyDraft(today), filePath: null, pageNumber: null, preview: null, source: "A mano", corrected: {} }])
        }
        onCheckNumber={(draft) => void refreshExisting([draft])}
        onSave={save}
        onCancel={() => close(false)}
      />
    </>
  );
}
