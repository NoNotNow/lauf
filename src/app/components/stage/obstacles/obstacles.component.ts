import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Point } from '../../../models/point';
import { CanvasLayerComponent } from '../../common/canvas-layer/canvas-layer.component';

@Component({
  selector: 'app-obstacles',
  standalone: true,
  imports: [CanvasLayerComponent],
  templateUrl: './obstacles.component.html',
  styleUrl: './obstacles.component.scss'
})
export class ObstaclesComponent implements OnChanges {
  @Input() size: Point = new Point(10, 10); // x: cols, y: rows
  @Input() color: string = 'rgba(200,0,0,0.6)';

  private obstacles = new Set<string>();
  redrawKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['size'] || changes['color']) {
      this.updateRedrawKey();
    }
  }

  // Public API: set or clear an obstacle at a grid point
  setObstacle(point: Point, present: boolean = true): void {
    const key = this.key(point.x, point.y);
    if (present) this.obstacles.add(key); else this.obstacles.delete(key);
    this.bumpRedraw();
  }

  clearAll(): void {
    this.obstacles.clear();
    this.bumpRedraw();
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x)},${Math.floor(y)}`;
  }

  // Draw callback for CanvasLayerComponent
  drawObstacles = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const cols = Math.max(1, Math.floor(this.size?.x ?? 1));
    const rows = Math.max(1, Math.floor(this.size?.y ?? 1));
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    ctx.fillStyle = this.color;

    const pad = Math.max(0, Math.min(cellW, cellH) * 0.08);
    for (const key of this.obstacles) {
      const [sx, sy] = key.split(',').map(n => parseInt(n, 10));
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue;
      const x = sx * cellW + pad;
      const y = sy * cellH + pad;
      const w = Math.max(0, cellW - 2 * pad);
      const h = Math.max(0, cellH - 2 * pad);
      ctx.fillRect(x, y, w, h);
    }
  };

  private bumpRedraw(): void {
    this.updateRedrawKey();
  }

  private updateRedrawKey(): void {
    const N = Math.max(1, Math.floor(this.size?.x ?? 1));
    const M = Math.max(1, Math.floor(this.size?.y ?? 1));
    // Incorporate obstacles count to trigger redraw on changes
    this.redrawKey = `${N}x${M}-${this.color}-${this.obstacles.size}-${Date.now()}`;
  }
}
