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
import { Drifter } from '../../../../core/rendering/transformers/drifter';
import { CollisionHandler } from '../../../../core/rendering/collision-handler';
import { AxisAlignedBoundingBox } from '../../../../core/rendering/collision';

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
    private drifters: Drifter[] = [];
    private collisions?: CollisionHandler;
    enableItemCollisions = true;

    // Helper to compute current grid boundary in cell coordinates
    private getGridBoundary(): AxisAlignedBoundingBox | undefined {
        return this.gridSize
            ? { minX: 0, minY: 0, maxX: this.gridSize.x, maxY: this.gridSize.y }
            : undefined;
    }

    constructor(
    private startup: StartupService,
    private animator: AnimatorService,
    private ticker: TickService
  ) {
    if (this.enableItemCollisions) {
      this.collisions = new CollisionHandler(this.ticker);
      // Ensure perfectly elastic item–item collisions by default
      this.collisions.setRestitutionDefault(1.0);
    }
  }

    ngAfterViewInit(): void {
        // Trigger startup to load and provide the Map to this component
        this.startup.main(this);
        // Start ticking and request redraw on each frame
        this.ticker.start();
        this.tickSub = this.ticker.ticks$.subscribe(() => this.animLayer?.requestRedraw());
        if (this.enableItemCollisions) {
            this.collisions?.start();
        }
    }

    ngOnDestroy(): void {
        this.tickSub?.unsubscribe?.();
        this.ticker.stop();
        this.rotators.forEach(r => r.stop());
        this.wobblers.forEach(w => w.stop());
        this.drifters.forEach(d => d.stop());
        this.animator.destroy();
        this.collisions?.stop();
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
        this.drifters.forEach(d => d.stop());
        this.rotators = [];
        this.wobblers = [];
        this.drifters = [];
        this.collisions?.clear();

        // Give every obstacle its own rotator and drifter with random parameters
        const obstacles = m.obstacles ?? [];
        const boundary: AxisAlignedBoundingBox | undefined = this.getGridBoundary();
        for (const obstacle of obstacles) {
            // register obstacle into collision handler first (obstacles only)
            if (this.enableItemCollisions) {
                this.collisions?.add(obstacle);
            }
            // Random rotation parameters
            const speed = 5 + Math.random() * 25; // 5..30 deg/s
            const dir: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
            const rot = new Rotator(this.ticker, obstacle, speed, dir);
            if (boundary) rot.setBoundary(boundary);
            rot.start();
            this.rotators.push(rot);
            {
                // Drifter: slow random drift with bouncing inside grid bounds
                const maxSpeed = 0.02 + Math.random() * 50; // 0.02..~2.02 cells/s
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * maxSpeed; // random magnitude up to max
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                const drift = new Drifter(this.ticker, obstacle, maxSpeed, boundary, true);
                drift.setVelocity(vx, vy);
                drift.start();
                this.drifters.push(drift);
            }
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
