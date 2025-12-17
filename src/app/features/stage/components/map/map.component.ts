import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {GridComponent} from '../grid/grid.component';
import {Point} from '../../../../core/models/point';
import {HtmlGameItemComponent} from '../html-game-item/html-game-item.component';
import {Map as GameMap} from '../../../../core/models/map';
import {StartupService, MapLoader} from '../../../../core/services/startup.service';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
import { AnimatorService } from '../../../../core/rendering/animator.service';
import { TickService } from '../../../../core/services/tick.service';
import { Rotator } from '../../../../core/rendering/transformers/rotator';
import { Wobbler } from '../../../../core/rendering/transformers/wobbler';

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [GridComponent, CanvasLayerComponent, HtmlGameItemComponent],
    providers: [],
    templateUrl: './map.component.html',
    styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit, OnDestroy, MapLoader {
    // Configure grid appearance
    gridColor = '#cccccc';
    gridLineWidth = 0.01; // in cell units (1.0 == one cell)
    gridSize: Point = new Point(10, 10);

    @ViewChild(CanvasLayerComponent)
    animLayer!: CanvasLayerComponent;

    @ViewChild('targetsLayer')
    targets!: HtmlGameItemComponent;

    @ViewChild('avatarsLayer')
    avatars!: HtmlGameItemComponent;

    // Draw callback for the animator-driven obstacles layer
    drawFrame = (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: any) => {
        if (!geom) return;
        this.animator.draw(ctx, geom);
    };

    private tickSub?: any;
    private rotators: Rotator[] = [];
    private wobblers: Wobbler[] = [];

    constructor(
        private startup: StartupService,
        private animator: AnimatorService,
        private ticker: TickService
    ) {}

    ngAfterViewInit(): void {
        // Trigger startup to load and provide the Map to this component
        this.startup.main(this);
        // Start ticking and request redraw on each frame
        this.ticker.start();
        this.tickSub = this.ticker.ticks$.subscribe(() => this.animLayer?.requestRedraw());
    }

    ngOnDestroy(): void {
        this.tickSub?.unsubscribe?.();
        this.ticker.stop();
        this.rotators.forEach(r => r.stop());
        this.wobblers.forEach(w => w.stop());
        this.animator.destroy();
    }

    // Accepts a Map object and applies it to the grid, obstacles, and game items layers
    loadMap(m: GameMap): void {
        console.log('Loaded map:', m);
        if (!m) return;
        // Update grid size from map
        if (m.size) {
            this.gridSize = new Point(m.size.x, m.size.y);
        }

        // Provide map to animator (obstacles drawn via canvas layer per tick)
        this.animator.setMap(m);

        // Stop existing transformers if reloading a map
        this.rotators.forEach(r => r.stop());
        this.wobblers.forEach(w => w.stop());
        this.rotators = [];
        this.wobblers = [];

        // Give every obstacle its own rotator and wobbler with random parameters
        const obstacles = m.obstacles ?? [];
        for (const obstacle of obstacles) {
            // Random rotation parameters
            const speed = 5 + Math.random() * 25; // 5..30 deg/s
            const dir: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
            const rot = new Rotator(this.ticker, obstacle, speed, dir);
            rot.start();
            this.rotators.push(rot);

            // Random wobble parameters
            const amp = 0.05 + Math.random() * 0.2; // 0.05..0.25 cells
            const freq = 0.2 + Math.random() * 0.8; // 0.2..1.0 Hz
            const wob = new Wobbler(this.ticker, obstacle, amp, freq);
            wob.start();
            this.wobblers.push(wob);
        }

        // Load targets
        if (this.targets) {
            this.targets.items = m.targets || [];
        }

        // Load avatars
        if (this.avatars && m.avatars) {
            this.avatars.items = [m.avatars];
        }
    }
}
