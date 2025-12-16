import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Point } from '../../../../core/models/point';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
import { Obstacle } from '../../../../core/models/game-items/stage-items';

@Component({
  selector: 'app-obstacles',
  standalone: true,
  imports: [CanvasLayerComponent],
  templateUrl: './obstacles.component.html',
  styleUrl: './obstacles.component.scss'
})
export class ObstaclesComponent implements OnChanges {
  @Input() gridSize: Point = new Point(10, 10); // x: cols, y: rows
  @Input() color: string = 'rgba(200,0,0,0.6)'; // fallback color if item has none
  @Input() items: Obstacle[] = [];

  redrawKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gridSize'] || changes['color'] || changes['items']) {
      this.updateRedrawKey();
    }
  }

  // Draw callback for CanvasLayerComponent: delegate to items
  drawObstacles = (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: any) => {
    if (!geom) return;
    for (const item of this.items ?? []) {
      try {
        // let item decide how to draw; provide geometry for placement
        item?.draw?.(ctx, geom);
      } catch (e) {
        // fail-safe: continue drawing other items
        // eslint-disable-next-line no-console
        console.warn('Failed to draw obstacle', e, item);
      }
    }
  };

  private updateRedrawKey(): void {
    const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
    const count = this.items?.length ?? 0;
    // Include a monotonic component to ensure actual redraw on same-count updates
    this.redrawKey = `${N}x${M}-${this.color}-${count}-${Date.now()}`;
  }
}
