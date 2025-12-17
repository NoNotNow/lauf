import { Injectable } from '@angular/core';
import { Map as GameMap } from '../models/map';
import { StageItem } from '../models/game-items/stage-item';
import { GridGeometry } from '../models/canvas-geometry';
import { StageItemBitmap } from './stage-item-bitmap';

interface BitmapEntry {
  item: StageItem;
  bmp: StageItemBitmap;
}

@Injectable({ providedIn: 'root' })
export class AnimatorService {
  private map?: GameMap;
  private bitmaps: BitmapEntry[] = [];
  private supersample = 2;

  setMap(map?: GameMap): void {
    this.map = map;
    this.rebuildBitmaps();
  }

  setSupersample(factor: number): void {
    const f = Math.max(1, Math.floor(factor || 1));
    if (f === this.supersample) return;
    this.supersample = f;
    // propagate to all bitmaps
    for (const e of this.bitmaps) e.bmp.setSupersample(f);
  }

  // Draw current frame into given context using grid geometry
  draw(ctx: CanvasRenderingContext2D, geom: GridGeometry): void {
    if (!this.map || !geom) return;
    // Obstacles (static for now)
    for (const { item, bmp } of this.bitmaps) {
      try {
        bmp.draw(ctx, item.Pose, geom);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Animator draw failed for item', e, item);
      }
    }
  }

  destroy(): void {
    for (const e of this.bitmaps) e.bmp.destroy();
    this.bitmaps = [];
  }

  private rebuildBitmaps(): void {
    // dispose previous
    for (const e of this.bitmaps) e.bmp.destroy();
    this.bitmaps = [];
    const obstacles = this.map?.obstacles ?? [];
    for (const item of obstacles) {
      this.bitmaps.push({ item, bmp: new StageItemBitmap(item, undefined as any, this.supersample) });
    }
  }
}
