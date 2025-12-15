import {Point} from "../point";
import {StageItem} from "./stage-item";
import { GridGeometry } from "../canvas-geometry";


export class Obstacle extends StageItem {
    public override draw(ctx: CanvasRenderingContext2D, geom: GridGeometry): void {
        const posX = Math.floor(this.Position?.x ?? 0);
        const posY = Math.floor(this.Position?.y ?? 0);
        const wCells = Math.max(1, Math.floor(this.Size?.x ?? 1));
        const hCells = Math.max(1, Math.floor(this.Size?.y ?? 1));

        const padRatio = 0.08; // small inset for aesthetics
        const { x, y, w, h } = geom.rectForCells(posX, posY, wCells, hCells, padRatio);

        // Fill
        const fill = this.Design?.Color ?? 'rgba(200,0,0,0.6)';
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);

        // Optional border
        const bw = Math.max(0, Math.floor(this.Design?.BorderWidth ?? 0));
        if (bw > 0) {
            ctx.lineWidth = bw;
            if (this.Design?.BorderColor) ctx.strokeStyle = this.Design.BorderColor;
            ctx.strokeRect(x, y, w, h);
        }
    }
}
export class Target extends StageItem {

}

export class GameCharacter extends StageItem {}

export class Avatar extends GameCharacter {

}



