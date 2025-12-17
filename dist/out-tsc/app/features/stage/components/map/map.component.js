var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Component, ViewChild } from '@angular/core';
import { GridComponent } from '../grid/grid.component';
import { Point } from '../../../../core/models/point';
import { HtmlGameItemComponent } from '../html-game-item/html-game-item.component';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
import { Rotator } from '../../../../core/rendering/transformers/rotator';
import { Drifter } from '../../../../core/rendering/transformers/drifter';
import { CollisionHandler } from '../../../../core/rendering/collision-handler';
let MapComponent = class MapComponent {
    // Helper to compute current grid boundary in cell coordinates
    getGridBoundary() {
        return this.gridSize
            ? { minX: 0, minY: 0, maxX: this.gridSize.x, maxY: this.gridSize.y }
            : undefined;
    }
    constructor(startup, animator, ticker) {
        this.startup = startup;
        this.animator = animator;
        this.ticker = ticker;
        // Configure grid appearance
        this.gridColor = '#cccccc';
        this.gridLineWidth = 0.01; // in cell units (1.0 == one cell)
        this.gridSize = new Point(10, 10);
        // Draw callback for the animator-driven obstacles layer
        this.drawFrame = (ctx, _canvas, geom) => {
            if (!geom)
                return;
            this.animator.draw(ctx, geom);
        };
        this.rotators = [];
        this.wobblers = [];
        this.drifters = [];
        this.enableItemCollisions = true;
        if (this.enableItemCollisions) {
            this.collisions = new CollisionHandler(this.ticker);
            // Ensure perfectly elastic item–item collisions by default
            this.collisions.setRestitutionDefault(1.0);
        }
    }
    ngAfterViewInit() {
        // Trigger startup to load and provide the Map to this component
        this.startup.main(this);
        // Start ticking and request redraw on each frame
        this.ticker.start();
        this.tickSub = this.ticker.ticks$.subscribe(() => this.animLayer?.requestRedraw());
        if (this.enableItemCollisions) {
            this.collisions?.start();
        }
    }
    ngOnDestroy() {
        this.tickSub?.unsubscribe?.();
        this.ticker.stop();
        this.rotators.forEach(r => r.stop());
        this.wobblers.forEach(w => w.stop());
        this.drifters.forEach(d => d.stop());
        this.animator.destroy();
        this.collisions?.stop();
    }
    // Accepts a Map object and applies it to the grid, obstacles, and game items layers
    loadMap(m) {
        console.log('Loaded map:', m);
        if (!m)
            return;
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
        const boundary = this.getGridBoundary();
        for (const obstacle of obstacles) {
            // register obstacle into collision handler first (obstacles only)
            if (this.enableItemCollisions) {
                this.collisions?.add(obstacle);
            }
            // Random rotation parameters
            const speed = 5 + Math.random() * 25; // 5..30 deg/s
            const dir = Math.random() < 0.5 ? -1 : 1;
            const rot = new Rotator(this.ticker, obstacle, speed, dir);
            if (boundary)
                rot.setBoundary(boundary);
            rot.start();
            this.rotators.push(rot);
            {
                // Drifter: slow random drift with bouncing inside grid bounds
                const maxSpeed = 0.02 + Math.random() * 2; // 0.02..~2.02 cells/s
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
};
__decorate([
    ViewChild(CanvasLayerComponent)
], MapComponent.prototype, "animLayer", void 0);
__decorate([
    ViewChild('targetsLayer')
], MapComponent.prototype, "targets", void 0);
__decorate([
    ViewChild('avatarsLayer')
], MapComponent.prototype, "avatars", void 0);
MapComponent = __decorate([
    Component({
        selector: 'app-map',
        standalone: true,
        imports: [GridComponent, CanvasLayerComponent, HtmlGameItemComponent],
        providers: [],
        templateUrl: './map.component.html',
        styleUrl: './map.component.scss'
    })
], MapComponent);
export { MapComponent };
//# sourceMappingURL=map.component.js.map