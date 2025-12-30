import {StageItem} from "../models/game-items/stage-item";
import {GridGeometry} from "../models/canvas-geometry";
import {ImageCache} from "./image-cache";
import {applyDashStyle, pathRoundedRect} from "./render-utils";

export class StageItemRenderer {
    constructor(private imageCache: ImageCache = new ImageCache()) {
    }

    // Draws a StageItem using provided canvas context and grid geometry
    draw(item: StageItem, ctx: CanvasRenderingContext2D, geom: GridGeometry): void {
        if (!item) return;

        const posX = item.Pose?.Position?.x ?? 0;
        const posY = item.Pose?.Position?.y ?? 0;
        const wCells = item.Pose?.Size?.x ?? 1;
        const hCells = item.Pose?.Size?.y ?? 1;

        // Resolve design properties
        const fill = item.Design?.Color ?? 'rgba(200,0,0,0.6)';
        const bwCells = Math.max(0, Number(item.Design?.Border?.Width ?? 0));
        const bw = bwCells * Math.min(geom.cellW, geom.cellH);
        const borderStyle = (item.Design?.Border?.Style ?? '').toLowerCase(); // none | solid | dashed
        const borderColor = item.Design?.Border?.Color ?? '#000000';
        const radiusCells = Math.max(0, Number(item.Design?.CornerRadius ?? 0));
        const radius = radiusCells * Math.min(geom.cellW, geom.cellH);
        const imageUrl = item.Design?.Image ?? '';

        // Calculate the base rectangle without padding first
        const base = geom.rectForCells(posX, posY, wCells, hCells, 0);
        
        // Early exit: skip if item is completely off-screen
        // Check if the item is outside the canvas bounds (with small margin for safety)
        const canvas = ctx.canvas;
        const margin = 10; // pixels margin
        if (base.x + base.w < -margin || base.x > canvas.width + margin ||
            base.y + base.h < -margin || base.y > canvas.height + margin) {
            return; // Item is completely off-screen
        }
        
        // We want the border to be "inside" the base rectangle (border-box).
        // If the border is thicker than the item, we cap it and center it.
        const effectiveBw = (borderStyle === 'none') ? 0 : Math.min(bw, base.w, base.h);
        const padX = effectiveBw / 2;
        const padY = effectiveBw / 2;
        
        const x = base.x + padX;
        const y = base.y + padY;
        const w = Math.max(0, base.w - effectiveBw);
        const h = Math.max(0, base.h - effectiveBw);

        // Draw filled rounded rect
        ctx.save();
        pathRoundedRect(ctx, x, y, w, h, radius);
        ctx.fillStyle = fill;
        ctx.fill();

        // Optional image overlay
        if (imageUrl && w > 0 && h > 0) {
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
        if (effectiveBw > 0) {
            ctx.lineWidth = effectiveBw;
            ctx.strokeStyle = borderColor;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            applyDashStyle(ctx, borderStyle, effectiveBw);
            pathRoundedRect(ctx, x, y, w, h, radius);
            ctx.stroke();
        }
        ctx.restore();
    }
}
