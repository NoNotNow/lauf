import { StageItem } from "../models/game-items/stage-item";
import { GridGeometry } from "../models/canvas-geometry";
import { ImageCache } from "./image-cache";

export class StageItemRenderer {
  constructor(private imageCache: ImageCache = new ImageCache()) {}

  // Draws a StageItem using provided canvas context and grid geometry
  draw(item: StageItem, ctx: CanvasRenderingContext2D, geom: GridGeometry): void {
    if (!item) return;

    const posX = Math.floor(item.Pose?.Position?.x ?? 0);
    const posY = Math.floor(item.Pose?.Position?.y ?? 0);
    const wCells = Math.max(1, Math.floor(item.Pose?.Size?.x ?? 1));
    const hCells = Math.max(1, Math.floor(item.Pose?.Size?.y ?? 1));

    const padRatio = 0.08; // small inset for aesthetics
    const { x, y, w, h } = geom.rectForCells(posX, posY, wCells, hCells, padRatio);

    // Build rounded-rect path helper
    const pathRoundedRect = (
      ctx2: CanvasRenderingContext2D,
      rx: number,
      ry: number,
      rw: number,
      rh: number,
      r: number
    ) => {
      const rr = Math.max(0, Math.min(r, Math.min(rw, rh) / 2));
      if (rr <= 0) {
        ctx2.beginPath();
        ctx2.rect(rx, ry, rw, rh);
        return;
      }
      const r2 = rr;
      ctx2.beginPath();
      ctx2.moveTo(rx + r2, ry);
      ctx2.lineTo(rx + rw - r2, ry);
      ctx2.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r2);
      ctx2.lineTo(rx + rw, ry + rh - r2);
      ctx2.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r2, ry + rh);
      ctx2.lineTo(rx + r2, ry + rh);
      ctx2.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r2);
      ctx2.lineTo(rx, ry + r2);
      ctx2.quadraticCurveTo(rx, ry, rx + r2, ry);
    };

    // Resolve design properties
    const fill = item.Design?.Color ?? 'rgba(200,0,0,0.6)';
    const bwCells = Math.max(0, Number(item.Design?.BorderWidth ?? 0));
    const bw = bwCells * Math.min(geom.cellW, geom.cellH);
    const borderStyle = (item.Design?.Border ?? '').toLowerCase(); // none | solid | dashed
    const borderColor = item.Design?.BorderColor ?? '#000000';
    const radiusCells = Math.max(0, Number(item.Design?.BorderRadius ?? 0));
    const radius = radiusCells * Math.min(geom.cellW, geom.cellH);
    const imageUrl = item.Design?.Image ?? '';

    // Draw filled rounded rect
    ctx.save();
    pathRoundedRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();

    // Optional image overlay
    if (imageUrl) {
      const img = this.imageCache.get(imageUrl);
      if (img && (img.complete && img.naturalWidth > 0)) {
        pathRoundedRect(ctx, x, y, w, h, radius);
        ctx.save();
        ctx.clip();
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = x + (w - dw) / 2;
        const dy = y + (h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      }
    }

    // Optional border (respect style)
    if (bw > 0 && borderStyle !== 'none') {
      ctx.lineWidth = bw;
      ctx.strokeStyle = borderColor;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (borderStyle === 'dashed') {
        const dash = Math.max(2, bw * 2);
        const gap = Math.max(2, Math.round(bw * 1.5));
        ctx.setLineDash([dash, gap]);
      } else {
        ctx.setLineDash([]);
      }
      pathRoundedRect(ctx, x, y, w, h, radius);
      ctx.stroke();
    }
    ctx.restore();
  }
}
