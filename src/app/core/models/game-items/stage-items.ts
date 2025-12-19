import {Point} from "../point";
import {StageItem} from "./stage-item";
import { GridGeometry } from "../canvas-geometry";
import { UserControllerParams } from "../user-controller-params";


export class Obstacle extends StageItem {

}
export class Target extends StageItem {

}

export class GameCharacter extends StageItem {}

export class Avatar extends GameCharacter {
    public controllerParams?: UserControllerParams;

    public override FromJson(data: any): this {
        super.FromJson(data);
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);

        const params = g('controllerParams', 'ControllerParams');
        if (params) {
            this.controllerParams = params;
        }

        return this;
    }
}



