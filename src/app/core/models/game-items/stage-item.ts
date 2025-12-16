import {Design} from "../design";
import { Pose } from "../pose";

export class StageItem {

    public Pose:Pose;
    public Design: Design;

    // Fills current instance from a plain JSON/object without replacing it
    public FromJson(data: any): this {
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);

        // Prefer nested Pose if present; otherwise accept Position/Size at root for backward-compat
        const poseData = g('Pose','pose') ?? data;
        if (!this.Pose) this.Pose = new Pose();
        this.Pose.FromJson(poseData);

        const design = g('Design','design');
        if (design) {
            if (!this.Design) this.Design = new Design();
            this.Design.FromJson(design);
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
            BorderColor: this.Design.BorderColor,
            BorderWidth: this.Design.BorderWidth,
            BorderRadius: this.Design.BorderRadius,
            Image: this.Design.Image
        } : undefined;
        return {
            Pose: pose,
            Design: design
        };
    }
}
