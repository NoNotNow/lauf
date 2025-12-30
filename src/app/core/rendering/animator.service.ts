import { Injectable } from '@angular/core';
import { Map as GameMap } from '../models/map';
import { StageItem } from '../models/game-items/stage-item';
import { GridGeometry } from '../models/canvas-geometry';
import { StageItemBitmap } from './stage-item-bitmap';
import { Camera } from './camera';

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
  private camera?: Camera;

  setMap(map?: GameMap): void {
    this.map = map;
    this.rebuildBitmaps();
  }

  setCamera(camera?: Camera): void {
    this.camera = camera;
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

  // Check if an item is within the viewport bounds
  // Uses current item positions, so it's always accurate even when items move
  private isItemInViewport(item: StageItem, viewportBounds: { minX: number; minY: number; maxX: number; maxY: number } | null): boolean {
    if (!viewportBounds) return true; // If no viewport bounds, draw everything

    const posX = item.Pose?.Position?.x ?? 0;
    const posY = item.Pose?.Position?.y ?? 0;
    const wCells = item.Pose?.Size?.x ?? 1;
    const hCells = item.Pose?.Size?.y ?? 1;

    // Calculate item bounds (using current position)
    const itemMinX = posX - wCells / 2;
    const itemMaxX = posX + wCells / 2;
    const itemMinY = posY - hCells / 2;
    const itemMaxY = posY + hCells / 2;

    // Check for overlap with viewport (with margin for safety)
    // Use a larger margin to account for items that might be partially visible
    const margin = Math.max(2.0, Math.max(wCells, hCells) * 0.5); // At least 2 cells, or half the item size
    return !(itemMaxX < viewportBounds.minX - margin ||
             itemMinX > viewportBounds.maxX + margin ||
             itemMaxY < viewportBounds.minY - margin ||
             itemMinY > viewportBounds.maxY + margin);
  }

  // Draw current frame into given context using grid geometry
  draw(ctx: CanvasRenderingContext2D, geom: GridGeometry): void {
    if (!this.map || !geom) return;

    // Get viewport bounds for culling
    let viewportBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    if (this.camera) {
      viewportBounds = this.camera.getViewportBounds(geom.cols, geom.rows);
    }

    // Draw only items in viewport (using current positions for accurate culling)
    for (const { item, bmp } of this.bitmaps) {
      if (!this.isItemInViewport(item, viewportBounds)) {
        continue;
      }

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
      const entry: BitmapEntry = { item, bmp: new StageItemBitmap(item, undefined as any, this.supersample) };
      this.bitmaps.push(entry);
    }
  }
}
