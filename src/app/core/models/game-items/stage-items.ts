import {Point} from "../point";
import {StageItem} from "./stage-item";
import { GridGeometry } from "../canvas-geometry";


export class Obstacle extends StageItem {

}
export class Target extends StageItem {

}

export class GameCharacter extends StageItem {}

export interface Transformer {
    Type: string;
    Params: any;
}

export class Avatar extends GameCharacter {
    public transformers: Transformer[] = [];

    public override FromJson(data: any): this {
        super.FromJson(data);
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);

        const transformers = g('Transformers', 'transformers');
        if (Array.isArray(transformers)) {
            this.transformers = transformers.map(t => ({
                Type: t.Type ?? t.type,
                Params: t.Params ?? t.params
            }));
        }

        return this;
    }
}



