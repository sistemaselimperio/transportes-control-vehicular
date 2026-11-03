"use client";

import { Eraser } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

const HEIGHT = 192;
const INK = "#111111";

/**
 * Signature drawn with a finger or a mouse on a canvas. The result is a PNG data URL on a white
 * background (so it prints the same everywhere), or `null` once cleared. Strokes are kept in CSS
 * pixels and redrawn when the canvas is resized, e.g. when the phone rotates.
 */
export function SignaturePad({
  id,
  onChange,
  invalid,
}: {
  id: string;
  onChange: (dataUrl: string | null) => void;
  invalid?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scale = canvas.width / canvas.clientWidth;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes.current) {
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, 1.25, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      stroke.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  }, []);

  // Match the backing store to the displayed size, capped at 2x so the PNG stays small.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      redraw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([pointFrom(e)]);
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    strokes.current[strokes.current.length - 1]?.push(pointFrom(e));
    redraw();
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current?.toDataURL("image/png") ?? null);
  };

  const clear = () => {
    strokes.current = [];
    drawing.current = false;
    redraw();
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        id={id}
        role="img"
        aria-label="Recuadro para firmar con el dedo o el mouse"
        style={{ height: HEIGHT, touchAction: "none" }}
        className={cn(
          "w-full cursor-crosshair rounded-xl border-2 border-dashed bg-white",
          invalid ? "border-destructive" : "border-input",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <Button type="button" variant="outline" className="h-12 px-4 text-base" onClick={clear}>
        <Eraser aria-hidden />
        Borrar
      </Button>
    </div>
  );
}
