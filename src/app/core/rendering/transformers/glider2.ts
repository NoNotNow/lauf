import { TickService } from "../../services/tick.service";

export class Glider2 {
    constructor(tickerService: TickService, params?: any) { 
        tickerService.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
    }
    onTick(dtSec: number): void {
        console.log('Glider2 tick', dtSec);
    }
}