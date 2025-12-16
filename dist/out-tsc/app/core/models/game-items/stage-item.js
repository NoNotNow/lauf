import { Design } from "../design";
import { Pose } from "../pose";
export class StageItem {
    // Simple in-memory image cache for canvas drawing
    static { this._imageCache = new Map(); }
    static { this._requested = new Set(); }
    static getImage(url) {
        if (!url)
            return undefined;
        let img = this._imageCache.get(url);
        if (img)
            return img;
        img = new Image();
        // Ensure same-origin relative asset path works
        img.src = url;
        // When the image loads, store and request redraw of canvas layers
        if (!this._requested.has(url)) {
            this._requested.add(url);
            img.onload = () => {
                this._imageCache.set(url, img);
                // Notify any canvas layers to redraw
                try {
                    window.dispatchEvent(new CustomEvent('app-canvas-redraw'));
                }
                catch {
                    // ignore
                }
            };
            img.onerror = () => {
                // Failed load: still trigger a redraw to avoid permanent waiting states
                try {
                    window.dispatchEvent(new CustomEvent('app-canvas-redraw'));
                }
                catch {
                    // ignore
                }
            };
        }
        return img;
    }
    // Let items draw themselves given a canvas context and grid geometry.
    // Default implementation is a no-op.
    // Subclasses (e.g., Obstacle, Target, Avatar) could override.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    draw(ctx, geom) {
        const posX = Math.floor(this.Pose?.Position?.x ?? 0);
        const posY = Math.floor(this.Pose?.Position?.y ?? 0);
        const wCells = Math.max(1, Math.floor(this.Pose?.Size?.x ?? 1));
        const hCells = Math.max(1, Math.floor(this.Pose?.Size?.y ?? 1));
        const padRatio = 0.08; // small inset for aesthetics
        const { x, y, w, h } = geom.rectForCells(posX, posY, wCells, hCells, padRatio);
        // Build rounded-rect path helper
        const pathRoundedRect = (ctx2, rx, ry, rw, rh, r) => {
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
        const fill = this.Design?.Color ?? 'rgba(200,0,0,0.6)';
        // Interpret BorderWidth in cell units: 1.0 == one cell size thickness
        const bwCells = Math.max(0, Number(this.Design?.BorderWidth ?? 0));
        const bw = bwCells * Math.min(geom.cellW, geom.cellH);
        const borderStyle = (this.Design?.Border ?? '').toLowerCase(); // none | solid | dashed
        const borderColor = this.Design?.BorderColor ?? '#000000';
        // Interpret BorderRadius in cell units: 1.0 == one cell size.
        // Convert to pixels using the smaller cell dimension (cells are square by design; this is safe).
        const radiusCells = Math.max(0, Number(this.Design?.BorderRadius ?? 0));
        const radius = radiusCells * Math.min(geom.cellW, geom.cellH);
        const imageUrl = this.Design?.Image ?? '';
        // Draw filled rounded rect
        ctx.save();
        pathRoundedRect(ctx, x, y, w, h, radius);
        ctx.fillStyle = fill;
        ctx.fill();
        // Optional image overlay, clipped to rounded rect. Image covers the rect preserving aspect ratio.
        if (imageUrl) {
            const img = StageItem.getImage(imageUrl);
            if (img && (img.complete && img.naturalWidth > 0)) {
                // Clip to rounded rect
                pathRoundedRect(ctx, x, y, w, h, radius);
                ctx.save();
                ctx.clip();
                // Compute cover scaling
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
            else {
                // Image not yet loaded; onload will trigger a canvas redraw
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
            }
            else {
                ctx.setLineDash([]);
            }
            // redraw path for stroke
            pathRoundedRect(ctx, x, y, w, h, radius);
            ctx.stroke();
        }
        ctx.restore();
    }
    // Fills current instance from a plain JSON/object without replacing it
    FromJson(data) {
        if (!data)
            return this;
        const g = (k, alt) => data[k] ?? (alt ? data[alt] : undefined);
        // Prefer nested Pose if present; otherwise accept Position/Size at root for backward-compat
        const poseData = g('Pose', 'pose') ?? data;
        if (!this.Pose)
            this.Pose = new Pose();
        this.Pose.FromJson(poseData);
        const design = g('Design', 'design');
        if (design) {
            if (!this.Design)
                this.Design = new Design();
            this.Design.FromJson(design);
        }
        return this;
    }
}
//# sourceMappingURL=stage-item.js.map