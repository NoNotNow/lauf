var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Component, Input, ViewChild } from '@angular/core';
let CanvasLayerComponent = class CanvasLayerComponent {
    constructor(host) {
        this.host = host;
        this.onExternalRedraw = () => this.drawNow();
    }
    ngAfterViewInit() {
        this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
        this.resizeObserver.observe(this.host.nativeElement);
        this.resizeCanvas();
        // Listen for global redraw events (e.g., image assets loaded)
        window.addEventListener('app-canvas-redraw', this.onExternalRedraw);
    }
    ngOnDestroy() {
        this.resizeObserver?.disconnect();
        window.removeEventListener('app-canvas-redraw', this.onExternalRedraw);
    }
    ngOnChanges(changes) {
        if (changes['redrawKey'] && this.canvasRef?.nativeElement) {
            this.drawNow();
        }
    }
    requestRedraw() {
        this.drawNow();
    }
    resizeCanvas() {
        const el = this.host.nativeElement;
        const canvas = this.canvasRef.nativeElement;
        const rect = el.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        // CSS size
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        // Backing store size
        const displayWidth = Math.max(1, Math.floor(rect.width * dpr));
        const displayHeight = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
        this.drawNow();
    }
    drawNow() {
        const canvas = this.canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Clear before delegating
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Build geometry helper if gridSize is provided
        const cols = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
        const rows = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;
        const geom = {
            cols,
            rows,
            cellW,
            cellH,
            rectForCells: (col, row, wCells = 1, hCells = 1, padRatio = 0) => {
                const pad = Math.max(0, Math.min(cellW, cellH) * Math.max(0, Math.min(0.5, padRatio)));
                const x = col * cellW + pad;
                const y = row * cellH + pad;
                const w = Math.max(0, wCells * cellW - 2 * pad);
                const h = Math.max(0, hCells * cellH - 2 * pad);
                return { x, y, w, h };
            }
        };
        this.draw?.(ctx, canvas, geom);
    }
};
__decorate([
    ViewChild('canvas', { static: true })
], CanvasLayerComponent.prototype, "canvasRef", void 0);
__decorate([
    Input()
], CanvasLayerComponent.prototype, "draw", void 0);
__decorate([
    Input()
], CanvasLayerComponent.prototype, "redrawKey", void 0);
__decorate([
    Input()
], CanvasLayerComponent.prototype, "gridSize", void 0);
CanvasLayerComponent = __decorate([
    Component({
        selector: 'app-canvas-layer',
        standalone: true,
        templateUrl: './canvas-layer.component.html',
        styleUrl: './canvas-layer.component.scss'
    })
], CanvasLayerComponent);
export { CanvasLayerComponent };
//# sourceMappingURL=canvas-layer.component.js.map