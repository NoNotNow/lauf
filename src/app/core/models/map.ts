import {Avatar, Obstacle, Target} from "./game-items/stage-items";
import {Design} from "./design/design";
import {Point} from "./point";
import {Camera} from "../rendering/camera";

export class Map{
    public name:string;
    public size: Point;
    public obstacles: Obstacle[] = [];
    public targets: Target[] = [];
    public avatar: Avatar;
    public design: Design;
    public camera: Camera;
    public zoomLevels: number[] = [];
    public gravity?: number; // Gravity acceleration in cells/s^2

    // Fills the current instance from a plain JSON/object without replacing it
    public FromJson(data: any): this {
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);

        const name = g('name','Name');
        if (name !== undefined) this.name = String(name);

        const size = g('size','Size');
        if (size) {
            if (!this.size) this.size = new Point();
            this.size.x = Number(size.x ?? size.X ?? this.size.x ?? 0);
            this.size.y = Number(size.y ?? size.Y ?? this.size.y ?? 0);
        }

        const design = g('design','Design');
        if (design) {
            if (!this.design) this.design = new Design();
            this.design.FromJson(design);
        }

        const obstacles = g('obstacles','Obstacles');
        if (Array.isArray(obstacles)) {
            // mutate in place to preserve array reference
            this.obstacles.length = 0;
            for (const item of obstacles) {
                const o = new Obstacle();
                o.FromJson(item);
                this.obstacles.push(o);
            }
        }

        const targets = g('targets','Targets');
        if (Array.isArray(targets)) {
            this.targets.length = 0;
            for (const t of targets) {
                const target = new Target();
                target.FromJson?.(t); // if StageItem.FromJson via inheritance
                this.targets.push(target);
            }
        }

        const avatar = g('avatar','Avatar') ?? g('avatars','Avatars');
        if (avatar) {
            if (!this.avatar) this.avatar = new Avatar();
            this.avatar.FromJson?.(avatar);
        }

        const camera = g('camera', 'Camera');
        if (camera) {
            const pos = camera.position ?? camera.Position ?? camera.center ?? camera.Center;
            const initialPos = pos ? new Point(pos.x ?? pos.X, pos.y ?? pos.Y) : undefined;
            const zoom = camera.zoom ?? camera.Zoom ?? 1.0;
            this.camera = new Camera(initialPos, zoom);
            
            // Parse zoom levels from Camera.ZoomLevels
            const zoomLevels = camera.zoomLevels ?? camera.ZoomLevels;
            if (Array.isArray(zoomLevels)) {
                this.zoomLevels = zoomLevels.map(z => Number(z));
            }
        }

        const gravity = g('gravity', 'Gravity');
        if (gravity !== undefined) this.gravity = Number(gravity);

        return this;
    }
}