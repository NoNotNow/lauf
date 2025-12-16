import { Point } from "./point";
export class Pose {
    constructor(position, size, rotation) {
        this.Position = position;
        this.Size = size;
        this.Rotation = rotation;
    }
    // Fills current instance from a plain JSON/object without replacing it
    FromJson(data) {
        if (!data)
            return this;
        const g = (k, alt) => data[k] ?? (alt ? data[alt] : undefined);
        const pos = g('Position', 'position');
        if (pos) {
            if (!this.Position)
                this.Position = new Point();
            this.Position.x = Number(pos.x ?? pos.X ?? this.Position.x ?? 0);
            this.Position.y = Number(pos.y ?? pos.Y ?? this.Position.y ?? 0);
        }
        const size = g('Size', 'size');
        if (size) {
            if (!this.Size)
                this.Size = new Point();
            this.Size.x = Number(size.x ?? size.X ?? this.Size.x ?? 0);
            this.Size.y = Number(size.y ?? size.Y ?? this.Size.y ?? 0);
        }
        const rot = g('Rotation', 'rotation');
        if (rot !== undefined)
            this.Rotation = Number(rot);
        return this;
    }
}
//# sourceMappingURL=pose.js.map