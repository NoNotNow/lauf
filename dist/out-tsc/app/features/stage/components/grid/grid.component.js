var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Component, Input } from '@angular/core';
import { Point } from '../../../../core/models/point';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
let GridComponent = class GridComponent {
    constructor() {
        // Number of cells to display across each axis
        // Use Point: x = columns, y = rows
        this.gridSize = new Point(10, 10);
        // Grid line color and width (width in cell units; 1.0 == one cell thickness)
        this.color = '#cccccc';
        this.lineWidth = 0.02;
        // Changing this value forces CanvasLayer to redraw
        this.redrawKey = '';
        // Draw callback used by CanvasLayerComponent
        this.drawGrid = (ctx, canvas) => {
            const w = canvas.width;
            const h = canvas.height;
            const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
            const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
            const cellW = w / N;
            const cellH = h / M;
            const unit = Math.min(cellW, cellH);
            const lw = Math.max(1, Math.round((this.lineWidth ?? 0) * unit));
            const offset = (lw % 2 === 1) ? 0.5 : 0.0;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = lw;
            // Borders
            ctx.beginPath();
            ctx.moveTo(offset, 0);
            ctx.lineTo(offset, h);
            ctx.moveTo(w - offset, 0);
            ctx.lineTo(w - offset, h);
            ctx.moveTo(0, offset);
            ctx.lineTo(w, offset);
            ctx.moveTo(0, h - offset);
            ctx.lineTo(w, h - offset);
            ctx.stroke();
            if (N > 1) {
                for (let i = 1; i < N; i++) {
                    const x = offset + Math.round((i * (w - 1)) / N);
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                    ctx.stroke();
                }
                for (let i = 1; i < M; i++) {
                    const y = offset + Math.round((i * (h - 1)) / M);
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                }
            }
        };
    }
    ngOnChanges(changes) {
        if (changes['size'] || changes['color'] || changes['lineWidth']) {
            this.updateRedrawKey();
        }
    }
    updateRedrawKey() {
        const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
        const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
        this.redrawKey = `${N}x${M}-${this.color}-${this.lineWidth}`;
    }
};
__decorate([
    Input()
], GridComponent.prototype, "gridSize", void 0);
__decorate([
    Input()
], GridComponent.prototype, "color", void 0);
__decorate([
    Input()
], GridComponent.prototype, "lineWidth", void 0);
GridComponent = __decorate([
    Component({
        selector: 'app-grid',
        standalone: true,
        imports: [CanvasLayerComponent],
        templateUrl: './grid.component.html',
        styleUrl: './grid.component.scss'
    })
], GridComponent);
export { GridComponent };
//# sourceMappingURL=grid.component.js.map