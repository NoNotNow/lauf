import { StageItem } from "../models/game-items/stage-item";
import { Pose } from "../models/pose";
import { GridGeometry } from "../models/canvas-geometry";
import { StageItemRenderer } from "./stage-item-renderer";

// Pre-renders a StageItem once (unrotated) into an offscreen canvas at a configurable supersample factor.
// Later, draws that cached bitmap onto a target ctx at any Pose (position/size/rotation).
// Responsibilities:
// - Maintain cached prerender based on Size, Design, grid cell size, supersample
// - Provide draw(ctx, pose, geom) that blits with optional rotation
// - Allow invalidation when external factors change
export class StageItemBitmap {
  private offscreenCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
  private imageBitmap: ImageBitmap | null = null; // optional faster blit

  private currentKey = ""; // cache key derived from size/design/geom/supersample
  private redrawHandler?: (e: Event) => void;

  constructor(
    private item: StageItem,
    private renderer: StageItemRenderer = new StageItemRenderer(),
    private supersample: number = 2
  ) {
    // Invalidate when global redraw is requested (usually image assets became available)
    // This ensures we re-prerender to include newly loaded images.
    this.redrawHandler = () => this.invalidate();
    try {
      window.addEventListener('app-canvas-redraw', this.redrawHandler as EventListener);
    } catch {
      // non-browser contexts
    }
  }

  // Call to clean up event listeners if the instance is not needed anymore
  destroy(): void {
    if (this.redrawHandler) {
      try {
        window.removeEventListener('app-canvas-redraw', this.redrawHandler as EventListener);
      } catch { /* ignore */ }
      this.redrawHandler = undefined;
    }
  }

  updateItem(item: StageItem): void {
    this.item = item;
    this.invalidate();
  }

  setSupersample(factor: number): void {
    const f = Math.max(1, Math.floor(factor || 1));
    if (f !== this.supersample) {
      this.supersample = f;
      this.invalidate();
    }
  }

  invalidate(): void {
    this.currentKey = "";
    this.imageBitmap?.close?.();
    this.imageBitmap = null;
    this.offscreenCtx = null;
    this.offscreenCanvas = null;
  }

  // Draw the cached bitmap to the target context using the given pose and geometry.
  draw(targetCtx: CanvasRenderingContext2D, pose: Pose, geom: GridGeometry): void {
    if (!this.item || !pose || !geom) return;

    // Ensure prerender exists and is up-to-date for the desired size/design/geom.
    this.ensurePrerender(pose, geom);

    if (!this.offscreenCanvas) return;

    const wCells = Math.max(0.01, pose?.Size?.x ?? this.item.Pose?.Size?.x ?? 1);
    const hCells = Math.max(0.01, pose?.Size?.y ?? this.item.Pose?.Size?.y ?? 1);

    // Destination rect (no padding for blit; padding already baked if needed in renderer)
    const { x, y, w, h } = geom.rectForCells(
      pose?.Position?.x ?? 0,
      pose?.Position?.y ?? 0,
      wCells,
      hCells,
      0
    );

    const cx = x + w / 2;
    const cy = y + h / 2;
    const rotation = Number(pose?.Rotation ?? 0) * Math.PI / 180;

    targetCtx.save();
    if (rotation !== 0) {
      targetCtx.translate(cx, cy);
      targetCtx.rotate(rotation);
      // Draw centered
      if (this.imageBitmap) {
        targetCtx.drawImage(this.imageBitmap, -w / 2, -h / 2, w, h);
      } else {
        targetCtx.drawImage(this.offscreenCanvas as HTMLCanvasElement, -w / 2, -h / 2, w, h);
      }
    } else {
      if (this.imageBitmap) {
        targetCtx.drawImage(this.imageBitmap, x, y, w, h);
      } else {
        targetCtx.drawImage(this.offscreenCanvas as HTMLCanvasElement, x, y, w, h);
      }
    }
    targetCtx.restore();
  }

  private ensurePrerender(pose: Pose, geom: GridGeometry): void {
    const wCells = Math.max(1, Math.floor(pose?.Size?.x ?? this.item.Pose?.Size?.x ?? 1));
    const hCells = Math.max(1, Math.floor(pose?.Size?.y ?? this.item.Pose?.Size?.y ?? 1));

    // Key includes dimensions (in pixels), selected design fields, and supersample
    const pxW = Math.max(1, Math.round(wCells * geom.cellW));
    const pxH = Math.max(1, Math.round(hCells * geom.cellH));
    const d = this.item?.Design ?? {} as any;
    const key = [
      pxW,
      pxH,
      this.supersample,
      d.Color,
      d.Border,
      d.BorderColor,
      d.BorderWidth,
      d.BorderRadius,
      d.Image
    ].join("|");

    if (key === this.currentKey && this.offscreenCanvas) return;

    // (Re)build offscreen
    const ss = Math.max(1, this.supersample);
    const canvasW = pxW * ss;
    const canvasH = pxH * ss;

    // Create an offscreen canvas; prefer OffscreenCanvas if available
    let c: OffscreenCanvas | HTMLCanvasElement;
    let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
    if (typeof OffscreenCanvas !== "undefined") {
      c = new OffscreenCanvas(canvasW, canvasH);
      ctx = c.getContext("2d");
    } else {
      const el = document.createElement("canvas");
      el.width = canvasW;
      el.height = canvasH;
      c = el;
      ctx = el.getContext("2d");
    }
    if (!ctx) return;

    // Clear and scale for supersampling
    ctx.clearRect(0, 0, canvasW, canvasH);
    if (ss !== 1) {
      (ctx as CanvasRenderingContext2D).save?.();
      (ctx as CanvasRenderingContext2D).scale?.(ss, ss);
    }

    // Draw the item at origin with the requested size
    const clone = new StageItem().FromJson({
      Pose: {
        Position: { x: 0, y: 0 },
        Size: { x: wCells, y: hCells },
        Rotation: 0
      },
      Design: this.item.Design ? { ...this.item.ToJson()?.Design } : undefined
    });

    // Local geometry that uses same cell sizes but starts at 0,0
    const localGeom: GridGeometry = {
      cols: geom.cols,
      rows: geom.rows,
      cellW: geom.cellW,
      cellH: geom.cellH,
      rectForCells: (col: number, row: number, wCells2?: number, hCells2?: number, padRatio?: number) =>
        geom.rectForCells(col, row, wCells2, hCells2, padRatio)
    };

    this.renderer.draw(clone, ctx as CanvasRenderingContext2D, localGeom);

    if (ss !== 1) {
      (ctx as CanvasRenderingContext2D).restore?.();
    }

    // Cache
    this.offscreenCanvas = c;
    this.offscreenCtx = ctx;
    this.imageBitmap?.close?.();
    this.imageBitmap = null;

    // Try to create ImageBitmap for faster blits (ignore failures in older browsers)
    const anyWindow: any = (globalThis as any);
    if (anyWindow && typeof anyWindow.createImageBitmap === "function") {
      // createImageBitmap is async; we can kick it off but still use the canvas until ready
      (anyWindow.createImageBitmap as any)(c).then((bmp: ImageBitmap) => {
        // If key changed in the meantime, discard
        if (this.currentKey === key) {
          this.imageBitmap?.close?.();
          this.imageBitmap = bmp;
        }
      }).catch(() => {/* ignore */});
    }

    this.currentKey = key;
  }
}
