import { StageItem } from "../../models/game-items/stage-item";
import { TickService } from "../../services/tick.service";
import { StageItemPhysics } from "../physics/stage-item-physics";
import { ITransformer } from "./transformer.interface";

export class Glider2 implements ITransformer {
    private sub?: any;
    private _params: any;
    private _physics: StageItemPhysics;
    constructor(private tickerService: TickService,item:StageItem, params?: any) { 
        this._params = params || {};
        this._physics = StageItemPhysics.for(item);
    }
    start(): void {
        if (this.sub) return;
        this.sub = this.tickerService.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
    }
    stop(): void {
        this.sub?.unsubscribe();
        this.sub = undefined;
    }
    onTick(dtSec: number): void {
        console.log('Glider2 tick', dtSec);
        this._physics.accelerate(1,1,0.001);

    }
}