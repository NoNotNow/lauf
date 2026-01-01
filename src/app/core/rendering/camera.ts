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
  private aspectRatio: number = 1.0;

  private bounds?: { cols: number, rows: number };

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
    this.targetCenter = this.clampCenter(center, zoom);
    this.targetZoom = zoom;
  }

  setBounds(cols: number, rows: number): void {
    this.bounds = { cols, rows };
    this.center = this.clampCenter(this.center, this.zoom);
    this.targetCenter = this.clampCenter(this.targetCenter, this.targetZoom);
    this._dirty = true;
  }

  setAspectRatio(ratio: number): void {
    if (this.aspectRatio !== ratio) {
      this.aspectRatio = ratio;
      this.center = this.clampCenter(this.center, this.zoom);
      this.targetCenter = this.clampCenter(this.targetCenter, this.targetZoom);
      this._dirty = true;
    }
  }

  private calculateViewportSize(cols: number, rows: number, zoom: number): { w: number, h: number } {
    const gridAspect = cols / rows;
    if (this.aspectRatio > gridAspect) {
      // Canvas is wider than grid: height is the constraint
      const h = rows / zoom;
      const w = h * this.aspectRatio;
      return { w, h };
    } else {
      // Canvas is taller than grid: width is the constraint
      const w = cols / zoom;
      const h = w / this.aspectRatio;
      return { w, h };
    }
  }

  private clampCenter(center: Point, zoom: number): Point {
    if (!this.bounds) return center;

    const { w: viewWidth, h: viewHeight } = this.calculateViewportSize(this.bounds.cols, this.bounds.rows, zoom);

    const halfViewWidth = viewWidth / 2;
    const halfViewHeight = viewHeight / 2;

    let minX = halfViewWidth;
    let maxX = this.bounds.cols - halfViewWidth;
    let minY = halfViewHeight;
    let maxY = this.bounds.rows - halfViewHeight;

    // If viewport is larger than the map, center it
    if (viewWidth >= this.bounds.cols) {
      minX = maxX = this.bounds.cols / 2;
    }

    if (viewHeight >= this.bounds.rows) {
      minY = maxY = this.bounds.rows / 2;
    }

    const clampedX = Math.max(minX, Math.min(maxX, center.x));
    const clampedY = Math.max(minY, Math.min(maxY, center.y));

    return new Point(clampedX, clampedY);
  }

  getTargetCenter(): Point {
    return this.targetCenter;
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

    const oldCenterX = this.center.x;
    const oldCenterY = this.center.y;
    const oldZoom = this.zoom;

    this.center.x += dx * this.lerpFactor;
    this.center.y += dy * this.lerpFactor;
    this.zoom += dz * this.lerpFactor;

    // Ensure current center is also clamped during interpolation
    const clamped = this.clampCenter(this.center, this.zoom);
    this.center.x = clamped.x;
    this.center.y = clamped.y;

    // Only mark dirty if position/zoom actually changed significantly
    // This prevents unnecessary redraws during smooth panning
    const movedThreshold = 0.01; // pixels - only redraw if moved more than this
    if (Math.abs(this.center.x - oldCenterX) > movedThreshold ||
        Math.abs(this.center.y - oldCenterY) > movedThreshold ||
        Math.abs(this.zoom - oldZoom) > 0.001) {
      this._dirty = true;
    }
  }

  transformGeometry(baseGeom: GridGeometry, canvasWidth: number, canvasHeight: number): GridGeometry {
    const { w: viewWidth, h: viewHeight } = this.calculateViewportSize(baseGeom.cols, baseGeom.rows, this.zoom);

    // cellSize is now uniform and determined by the viewport-to-canvas ratio
    const cellSize = canvasWidth / viewWidth;

    // Top-left of the viewport in cell coordinates
    const viewX = this.center.x - viewWidth / 2;
    const viewY = this.center.y - viewHeight / 2;

    return {
      cols: baseGeom.cols,
      rows: baseGeom.rows,
      cellW: cellSize,
      cellH: cellSize,
      rectForCells: (col: number, row: number, wCells: number = 1, hCells: number = 1, padRatio: number = 0) => {
        const pad = padRatio > 0 ? (cellSize * (padRatio > 0.5 ? 0.5 : padRatio)) : 0;

        // Transform cell coordinates to screen pixels
        const x = (col - viewX) * cellSize + pad;
        const y = (row - viewY) * cellSize + pad;
        const w = wCells * cellSize - 2 * pad;
        const h = hCells * cellSize - 2 * pad;

        return { x, y, w: w < 0 ? 0 : w, h: h < 0 ? 0 : h };
      }
    };
  }

  getTargetZoom(): number {
    return this.targetZoom;
  }

  getZoom(): number {
    return this.zoom;
  }

  // Returns the viewport bounds in cell coordinates (minX, minY, maxX, maxY)
  // Useful for culling items that are outside the visible area
  getViewportBounds(cols: number, rows: number): { minX: number; minY: number; maxX: number; maxY: number } | null {
    // Use provided cols/rows if bounds not set (fallback)
    const effectiveCols = this.bounds?.cols ?? cols;
    const effectiveRows = this.bounds?.rows ?? rows;

    const { w: viewWidth, h: viewHeight } = this.calculateViewportSize(effectiveCols, effectiveRows, this.zoom);
    
    const viewX = this.center.x - viewWidth / 2;
    const viewY = this.center.y - viewHeight / 2;

    return {
      minX: viewX,
      minY: viewY,
      maxX: viewX + viewWidth,
      maxY: viewY + viewHeight
    };
  }
}
