import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Point } from '../../../models/point';
import { CanvasLayerComponent } from '../../common/canvas-layer/canvas-layer.component';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [CanvasLayerComponent],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss'
})
export class GridComponent implements OnChanges {
  // Number of cells to display across each axis
  // Use Point: x = columns, y = rows
  @Input() gridSize: Point = new Point(10, 10);

  // Grid line color and width (width in CSS pixels; DPR-adjusted for crispness)
  @Input() color: string = '#cccccc';
  @Input() lineWidth: number = 1;

  // Changing this value forces CanvasLayer to redraw
  redrawKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['size'] || changes['color'] || changes['lineWidth']) {
      this.updateRedrawKey();
    }
  }

  updateRedrawKey(): void {
    const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
    this.redrawKey = `${N}x${M}-${this.color}-${this.lineWidth}`;
  }

  // Draw callback used by CanvasLayerComponent
  drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const lw = Math.max(1, Math.round(this.lineWidth * dpr));
    const offset = (lw % 2 === 1) ? 0.5 : 0.0;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = lw;

    const w = canvas.width;
    const h = canvas.height;

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

    const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));

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
