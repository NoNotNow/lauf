var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Component, Input } from '@angular/core';
import { Point } from '../../../../core/models/point';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
let ObstaclesComponent = class ObstaclesComponent {
    constructor() {
        this.gridSize = new Point(10, 10); // x: cols, y: rows
        this.color = 'rgba(200,0,0,0.6)'; // fallback color if item has none
        this.items = [];
        this.redrawKey = '';
        // Draw callback for CanvasLayerComponent: delegate to items
        this.drawObstacles = (ctx, _canvas, geom) => {
            if (!geom)
                return;
            for (const item of this.items ?? []) {
                try {
                    // let item decide how to draw; provide geometry for placement
                    item?.draw?.(ctx, geom);
                }
                catch (e) {
                    // fail-safe: continue drawing other items
                    // eslint-disable-next-line no-console
                    console.warn('Failed to draw obstacle', e, item);
                }
            }
        };
    }
    ngOnChanges(changes) {
        if (changes['gridSize'] || changes['color'] || changes['items']) {
            this.updateRedrawKey();
        }
    }
    updateRedrawKey() {
        const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
        const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
        const count = this.items?.length ?? 0;
        // Include a monotonic component to ensure actual redraw on same-count updates
        this.redrawKey = `${N}x${M}-${this.color}-${count}-${Date.now()}`;
    }
};
__decorate([
    Input()
], ObstaclesComponent.prototype, "gridSize", void 0);
__decorate([
    Input()
], ObstaclesComponent.prototype, "color", void 0);
__decorate([
    Input()
], ObstaclesComponent.prototype, "items", void 0);
ObstaclesComponent = __decorate([
    Component({
        selector: 'app-obstacles',
        standalone: true,
        imports: [CanvasLayerComponent],
        templateUrl: './obstacles.component.html',
        styleUrl: './obstacles.component.scss'
    })
], ObstaclesComponent);
export { ObstaclesComponent };
//# sourceMappingURL=obstacles.component.js.map