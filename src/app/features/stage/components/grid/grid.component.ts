import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Point } from '../../../../core/models/point';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';

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

  // Grid line color and width (width in cell units; 1.0 == one cell thickness)
  @Input() color: string = '#cccccc';
  @Input() lineWidth: number = 0.02;

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
