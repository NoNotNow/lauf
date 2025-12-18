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
  // cache for ad-hoc rendered items (e.g., avatar layer)
  private adhocBitmaps?: Map<StageItem, StageItemBitmap>;

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
    // also propagate to adhoc items
    if (this.adhocBitmaps) {
      this.adhocBitmaps.forEach?.((bmp) => bmp.setSupersample(f));
    }
  }

  // Draw current frame into given context using grid geometry
  draw(ctx: CanvasRenderingContext2D, geom: GridGeometry): void {
    if (!this.map || !geom) return;

    // Optional: adapt supersample to zoom level for optimal performance/quality
    // If we are zoomed in, we might want higher supersampling, but StageItemBitmap already
    // uses geom.cellW which is larger when zoomed in.

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

  // Draw a provided list of items using the same bitmap pipeline (separate layer)
  drawItems(items: StageItem[] | undefined, ctx: CanvasRenderingContext2D, geom: GridGeometry): void {
    if (!items || !geom) return;
    if (!this.adhocBitmaps) this.adhocBitmaps = new Map<StageItem, StageItemBitmap>();
    for (const item of items) {
      if (!item) continue;
      let bmp = this.adhocBitmaps.get(item);
      if (!bmp) {
        bmp = new StageItemBitmap(item, undefined as any, this.supersample);
        this.adhocBitmaps.set(item, bmp);
      }
      try {
        bmp.draw(ctx, item.Pose, geom);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Animator drawItems failed for item', e, item);
      }
    }
  }

  destroy(): void {
    for (const e of this.bitmaps) e.bmp.destroy();
    this.bitmaps = [];
    if (this.adhocBitmaps) {
      this.adhocBitmaps.forEach?.((bmp) => bmp.destroy());
      this.adhocBitmaps = undefined;
    }
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
