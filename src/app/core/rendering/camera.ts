import { Point } from '../models/point';
import { GridGeometry } from '../models/canvas-geometry';

export interface Viewport {
  center: Point;
  zoom: number; // 1.0 means the 'visibleCells' fits the canvas
  visibleCells: number; // How many cells (approx) visible on the shorter axis
}

export class Camera {
  private center: Point = new Point(0, 0);
  private zoom: number = 1.0;
  private visibleCells: number = 10; // Default view width/height in cells

  // Smoothing
  private targetCenter: Point = new Point(0, 0);
  private targetZoom: number = 1.0;
  private lerpFactor: number = 0.1;

  constructor(initialCenter?: Point, initialVisibleCells: number = 10) {
    if (initialCenter) {
      this.center = new Point(initialCenter.x, initialCenter.y);
      this.targetCenter = new Point(initialCenter.x, initialCenter.y);
    }
    this.visibleCells = initialVisibleCells;
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
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 && Math.abs(dz) < 0.001) {
      this.center.x = this.targetCenter.x;
      this.center.y = this.targetCenter.y;
      this.zoom = this.targetZoom;
      return;
    }

    this.center.x += dx * this.lerpFactor;
    this.center.y += dy * this.lerpFactor;
    this.zoom += dz * this.lerpFactor;
  }

  transformGeometry(baseGeom: GridGeometry, canvasWidth: number, canvasHeight: number): GridGeometry {
    // The current GridGeometry assumes 0,0 is top-left and cells fill the canvas.
    // We want to override rectForCells to account for our camera.

    const aspect = canvasWidth / canvasHeight;
    
    // Effective number of cells visible on screen
    const viewWidth = this.visibleCells / this.zoom * (aspect > 1 ? aspect : 1);
    const viewHeight = this.visibleCells / this.zoom * (aspect > 1 ? 1 : 1 / aspect);

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
        const pad = Math.max(0, Math.min(cellW, cellH) * Math.max(0, Math.min(0.5, padRatio)));
        
        // Transform cell coordinates to screen pixels
        const x = (col - viewX) * cellW + pad;
        const y = (row - viewY) * cellH + pad;
        const w = Math.max(0, wCells * cellW - 2 * pad);
        const h = Math.max(0, hCells * cellH - 2 * pad);
        
        return { x, y, w, h };
      }
    };
  }

  getZoom(): number {
    return this.zoom;
  }
}
