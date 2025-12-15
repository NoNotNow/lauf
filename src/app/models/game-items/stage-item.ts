import {Point} from "../point";
import {Design} from "../design";
import { GridGeometry } from "../canvas-geometry";

export class StageItem {
    public Position : Point;
    public Size : Point;
    public Design: Design;

    // Let items draw themselves given a canvas context and grid geometry.
    // Default implementation is a no-op.
    // Subclasses (e.g., Obstacle, Target, Avatar) could override.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public draw(ctx: CanvasRenderingContext2D, geom: GridGeometry): void {
        const posX = Math.floor(this.Position?.x ?? 0);
        const posY = Math.floor(this.Position?.y ?? 0);
        const wCells = Math.max(1, Math.floor(this.Size?.x ?? 1));
        const hCells = Math.max(1, Math.floor(this.Size?.y ?? 1));

        const padRatio = 0.08; // small inset for aesthetics
        const { x, y, w, h } = geom.rectForCells(posX, posY, wCells, hCells, padRatio);

        // Build rounded-rect path helper
        const pathRoundedRect = (ctx2: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, r: number) => {
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

        // Draw filled rounded rect
        ctx.save();
        pathRoundedRect(ctx, x, y, w, h, radius);
        ctx.fillStyle = fill;
        ctx.fill();

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
            // redraw path for stroke
            pathRoundedRect(ctx, x, y, w, h, radius);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Fills current instance from a plain JSON/object without replacing it
    public FromJson(data: any): this {
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);

        const pos = g('Position','position');
        if (pos) {
            if (!this.Position) this.Position = new Point();
            this.Position.x = Number(pos.x ?? pos.X ?? this.Position.x ?? 0);
            this.Position.y = Number(pos.y ?? pos.Y ?? this.Position.y ?? 0);
        }

        const size = g('Size','size');
        if (size) {
            if (!this.Size) this.Size = new Point();
            this.Size.x = Number(size.x ?? size.X ?? this.Size.x ?? 0);
            this.Size.y = Number(size.y ?? size.Y ?? this.Size.y ?? 0);
        }

        const design = g('Design','design');
        if (design) {
            if (!this.Design) this.Design = new Design();
            this.Design.FromJson(design);
        }

        return this;
    }
}
