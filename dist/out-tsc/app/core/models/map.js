import { Avatar, Obstacle, Target } from "./game-items/stage-items";
import { Design } from "./design";
import { Point } from "./point";
export class Map {
    constructor() {
        this.obstacles = [];
        this.targets = [];
    }
    // Fills the current instance from a plain JSON/object without replacing it
    FromJson(data) {
        if (!data)
            return this;
        const g = (k, alt) => data[k] ?? (alt ? data[alt] : undefined);
        const name = g('name', 'Name');
        if (name !== undefined)
            this.name = String(name);
        const size = g('size', 'Size');
        if (size) {
            if (!this.size)
                this.size = new Point();
            this.size.x = Number(size.x ?? size.X ?? this.size.x ?? 0);
            this.size.y = Number(size.y ?? size.Y ?? this.size.y ?? 0);
        }
        const design = g('design', 'Design');
        if (design) {
            if (!this.design)
                this.design = new Design();
            this.design.FromJson(design);
        }
        const obstacles = g('obstacles', 'Obstacles');
        if (Array.isArray(obstacles)) {
            // mutate in place to preserve array reference
            this.obstacles.length = 0;
            for (const item of obstacles) {
                const o = new Obstacle();
                o.FromJson(item);
                this.obstacles.push(o);
            }
        }
        const targets = g('targets', 'Targets');
        if (Array.isArray(targets)) {
            this.targets.length = 0;
            for (const t of targets) {
                const target = new Target();
                target.FromJson?.(t); // if StageItem.FromJson via inheritance
                this.targets.push(target);
            }
        }
        const avatar = g('avatar', 'Avatar') ?? g('avatars', 'Avatars');
        if (avatar) {
            if (!this.avatars)
                this.avatars = new Avatar();
            this.avatars.FromJson?.(avatar);
        }
        return this;
    }
}
//# sourceMappingURL=map.js.map