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

    // Early exit: skip if item is completely off-screen
    // Check if the item is outside the canvas bounds (with small margin for safety)
    // This avoids expensive prerender operations for off-screen items
    const canvas = targetCtx.canvas;
    const margin = 10; // pixels margin
    if (x + w < -margin || x > canvas.width + margin ||
        y + h < -margin || y > canvas.height + margin) {
      return; // Item is completely off-screen
    }

    // Ensure prerender exists and is up-to-date for the desired size/design/geom.
    this.ensurePrerender(pose, geom);

    if (!this.offscreenCanvas) return;

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
    const wCells = pose?.Size?.x ?? this.item.Pose?.Size?.x ?? 1;
    const hCells = pose?.Size?.y ?? this.item.Pose?.Size?.y ?? 1;

    // Key includes dimensions (in pixels), selected design fields, and supersample
    const pxW = Math.max(1, Math.ceil(wCells * geom.cellW));
    const pxH = Math.max(1, Math.ceil(hCells * geom.cellH));
    const d = this.item?.Design ?? {} as any;
    const key = [
      pxW,
      pxH,
      this.supersample,
      d.Color,
      d.Border,
      d.BorderColor,
      d.BorderWidth,
      d.CornerRadius,
      d.Image,
      d.Opacity
    ].join("|");

    if (key === this.currentKey && this.offscreenCanvas) return;

    // (Re)build offscreen
    const ss = Math.max(1, this.supersample);
    const canvasW = pxW * ss;
    const canvasH = pxH * ss;

    // Create an offscreen canvas
    // Note: Firefox has performance issues with OffscreenCanvas.getContext("2d"),
    // so we use HTMLCanvasElement for better cross-browser performance
    const isFirefox = typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent);
    let c: OffscreenCanvas | HTMLCanvasElement;
    let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
    
    // Use HTMLCanvasElement on Firefox for better performance, OffscreenCanvas elsewhere
    if (!isFirefox && typeof OffscreenCanvas !== "undefined") {
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
    // We pass the original item's design directly to avoid unnecessary cloning/serialization
    const design = this.item.Design;

    // Local geometry that uses same cell sizes but starts at 0,0
    const localGeom: GridGeometry = {
      cols: geom.cols,
      rows: geom.rows,
      cellW: geom.cellW,
      cellH: geom.cellH,
      rectForCells: (col: number, row: number, wCells2: number = 1, hCells2: number = 1, padRatio: number = 0) => {
        const minSide = geom.cellW < geom.cellH ? geom.cellW : geom.cellH;
        const pad = padRatio > 0 ? (minSide * (padRatio > 0.5 ? 0.5 : padRatio)) : 0;
        const w = wCells2 * geom.cellW - 2 * pad;
        const h = hCells2 * geom.cellH - 2 * pad;
        return {
          x: col * geom.cellW + pad,
          y: row * geom.cellH + pad,
          w: w < 0 ? 0 : w,
          h: h < 0 ? 0 : h
        };
      }
    };

    // Create a minimal lightweight "item-like" object for the renderer
    const drawItem = {
      Pose: {
        Position: { x: 0, y: 0 },
        Size: { x: wCells, y: hCells },
        Rotation: 0
      },
      Design: design
    } as any;

    this.renderer.draw(drawItem, ctx as CanvasRenderingContext2D, localGeom);

    if (ss !== 1) {
      (ctx as CanvasRenderingContext2D).restore?.();
    }

    // Cache
    this.offscreenCanvas = c;
    this.offscreenCtx = ctx;
    this.imageBitmap?.close?.();
    this.imageBitmap = null;

    // Try to create ImageBitmap for faster blits (ignore failures in older browsers)
    // Note: Firefox's createImageBitmap can be slower, so we skip it on Firefox
    // If performance testing shows ImageBitmap helps on Firefox, remove the isFirefox check
    const anyWindow: any = (globalThis as any);
    if (!isFirefox && anyWindow && typeof anyWindow.createImageBitmap === "function") {
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
