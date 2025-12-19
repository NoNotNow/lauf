import {Design} from "../design/design";
import { Pose } from "../pose";
import {PhysicsConfiguration} from "./physics-configuration";

export class StageItem {

    public Pose: Pose = new Pose();
    public Design: Design = new Design();
    public Physics: PhysicsConfiguration = new PhysicsConfiguration();

    // Fills current instance from a plain JSON/object without replacing it
    public FromJson(data: any): this {
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);

        // Prefer nested Pose if present; otherwise accept Position/Size at root for backward-compat
        const poseData = g('Pose', 'pose') ?? data;
        this.Pose.FromJson(poseData);

        const design = g('Design', 'design');
        if (design) {
            this.Design.FromJson(design);
        }

        const physics = g('PhysicsConfiguration', 'physicsConfiguration') ?? g('Physics', 'physics');
        if (physics) {
            this.Physics.FromJson(physics);
        }

        const restitution = g('restitution', 'Restitution');
        if (restitution !== undefined) {
            this.Physics.restitution = Number(restitution);
        }

        return this;
    }

    // Serializes current instance to a plain JSON object
    public ToJson(): any {
        const pose = this.Pose ? {
            Position: this.Pose.Position ? { x: this.Pose.Position.x, y: this.Pose.Position.y } : undefined,
            Size: this.Pose.Size ? { x: this.Pose.Size.x, y: this.Pose.Size.y } : undefined,
            Rotation: this.Pose.Rotation
        } : undefined;
        const design = this.Design ? {
            Color: this.Design.Color,
            Border: this.Design.Border,
            BorderColor: this.Design.Border.Color,
            BorderWidth: this.Design.Border.Width,
            CornerRadius: this.Design.CornerRadius,
            Image: this.Design.Image
        } : undefined;
        return {
            Pose: pose,
            Design: design,
            PhysicsConfiguration: this.Physics.ToJson(),
            restitution: this.Physics.restitution
        };
    }
}
