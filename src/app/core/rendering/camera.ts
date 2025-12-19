import { Point } from '../models/point';
import { GridGeometry } from '../models/canvas-geometry';

export interface Viewport {
  center: Point;
  zoom: number; // 1.0 means the entirety of the grid is visible
}

export class Camera {
  private center: Point = new Point(0, 0);
  private zoom: number = 1.0;

  // Smoothing
  private targetCenter: Point = new Point(0, 0);
  private targetZoom: number = 1.0;
  private lerpFactor: number = 0.1;

  private _dirty = true;

  constructor(initialCenter?: Point, initialZoom: number = 1.0) {
    if (initialCenter) {
      this.center = new Point(initialCenter.x, initialCenter.y);
      this.targetCenter = new Point(initialCenter.x, initialCenter.y);
    }
    this.zoom = initialZoom;
    this.targetZoom = initialZoom;
  }

  get isDirty(): boolean {
    return this._dirty;
  }

  // Resets the dirty flag. Should be called after the view has been updated.
  clearDirty(): void {
    this._dirty = false;
  }

  setTarget(center: Point, zoom: number = 1.0): void {
    this.targetCenter = center;
    this.targetZoom = zoom;
  }

  update(): void {
    const dx = this.targetCenter.x - this.center.x;
    const dy = this.targetCenter.y - this.center.y;
    const dz = this.targetZoom - this.zoom;

    // Small threshold to stop updating if we are very close
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001 && Math.abs(dz) < 0.0001) {
      if (this.center.x !== this.targetCenter.x || this.center.y !== this.targetCenter.y || this.zoom !== this.targetZoom) {
        this.center.x = this.targetCenter.x;
        this.center.y = this.targetCenter.y;
        this.zoom = this.targetZoom;
        this._dirty = true;
      }
      return;
    }

    this.center.x += dx * this.lerpFactor;
    this.center.y += dy * this.lerpFactor;
    this.zoom += dz * this.lerpFactor;
    this._dirty = true;
  }

  transformGeometry(baseGeom: GridGeometry, canvasWidth: number, canvasHeight: number): GridGeometry {
    // The current GridGeometry assumes 0,0 is top-left and cells fill the canvas.
    // We want to override rectForCells to account for our camera.

    const aspect = canvasWidth / canvasHeight;

    // When zoom is 1, entirety of the grid is visible.
    // When zoom is 10, only 10% of it are visible.
    // This means viewSize = gridSide / zoom.
    
    // Effective number of cells visible on screen
    const viewWidth = baseGeom.cols / this.zoom;
    const viewHeight = baseGeom.rows / this.zoom;

    const cellW = canvasWidth / viewWidth;
    const cellH = canvasHeight / viewHeight;

    // Top-left of the viewport in cell coordinates
    const viewX = this.center.x - viewWidth / 2;
    const viewY = this.center.y - viewHeight / 2;

    return {
      cols: baseGeom.cols,
      rows: baseGeom.rows,
      cellW,
      cellH,
      rectForCells: (col: number, row: number, wCells: number = 1, hCells: number = 1, padRatio: number = 0) => {
        const minSide = cellW < cellH ? cellW : cellH;
        const pad = padRatio > 0 ? (minSide * (padRatio > 0.5 ? 0.5 : padRatio)) : 0;
        
        // Transform cell coordinates to screen pixels
        const x = (col - viewX) * cellW + pad;
        const y = (row - viewY) * cellH + pad;
        const w = wCells * cellW - 2 * pad;
        const h = hCells * cellH - 2 * pad;
        
        return { x, y, w: w < 0 ? 0 : w, h: h < 0 ? 0 : h };
      }
    };
  }

  getZoom(): number {
    return this.zoom;
  }
}
