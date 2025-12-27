import { TickService } from "../../services/tick.service";
import { ITransformer } from "./transformer.interface";

export class Glider2 implements ITransformer {
    private sub?: any;
    constructor(private tickerService: TickService, params?: any) { 
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
    }
}