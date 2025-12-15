import {Point} from "../point";
import {Design} from "../design";
import { GridGeometry } from "../canvas-geometry";

export class StageItem {
    public Position : Point;
    public Size : Point;
    public Design: Design;

    // Let items draw themselves given a canvas context and grid geometry.
    // Default implementation is a no-op.
    // Subclasses (e.g., Obstacle, Target, Avatar) should override.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public draw(ctx: CanvasRenderingContext2D, geom: GridGeometry): void {}

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
