import {Point} from "../point";
import {StageItem, Transformer} from "./stage-item";
import { GridGeometry } from "../canvas-geometry";


export class Obstacle extends StageItem {
}

export class Bird extends Obstacle {
    constructor() {
        super();
        this.Design.Image = 'assets/bird.svg';
        this.Physics.hasGravity = false;
        this.Physics.canMove = true;
        this.transformers.push({
            Type: 'Sailor',
            Params: {
                horizontalAmplitude: 4.0,
                horizontalFrequency: 0.05
            }
        });
    }
}

export class Target extends StageItem {

}

export class GameCharacter extends StageItem {
}

export class Avatar extends GameCharacter {
}



