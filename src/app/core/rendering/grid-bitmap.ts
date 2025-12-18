import { GridGeometry } from "../models/canvas-geometry";

export class GridBitmap {
  private pattern: CanvasPattern | null = null;
  private currentKey = "";

  invalidate(): void {
    this.currentKey = "";
    this.pattern = null;
  }

  draw(
    targetCtx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    geom: GridGeometry,
    color: string,
    lineWidth: number
  ): void {
    const key = `${geom.cellW}x${geom.cellH}-${color}-${lineWidth}`;

    if (key !== this.currentKey || !this.pattern) {
      this.createPattern(geom.cellW, geom.cellH, color, lineWidth, key);
    }

    if (!this.pattern) return;

    const gridRect = geom.rectForCells(0, 0, geom.cols, geom.rows);
    
    // We need to align the pattern with the grid's origin
    targetCtx.save();
    
    // Use setTransform to set the pattern's origin to the grid's top-left
    const matrix = new DOMMatrix().translate(gridRect.x, gridRect.y);
    this.pattern.setTransform(matrix);
    
    targetCtx.fillStyle = this.pattern;
    targetCtx.fillRect(gridRect.x, gridRect.y, gridRect.w, gridRect.h);

    // CanvasPattern only draws the "inner" lines if we're not careful.
    // Actually, it repeats. If we draw at (0,0) in pattern, it will be at (gridRect.x, gridRect.y).
    // To get the right and bottom borders, we might need one extra stroke or a slightly larger rect.
    // But usually we want the borders to be exactly on the edge.
    
    // Draw the outermost borders manually to ensure they are crisp and present
    const lw = Math.max(1, Math.round(lineWidth * Math.min(geom.cellW, geom.cellH)));
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = lw;
    targetCtx.strokeRect(gridRect.x, gridRect.y, gridRect.w, gridRect.h);

    targetCtx.restore();
  }

  private createPattern(
    cellW: number,
    cellH: number,
    color: string,
    lineWidth: number,
    key: string
  ): void {
    const unit = Math.min(cellW, cellH);
    const lw = Math.max(1, Math.round(lineWidth * unit));
    
    // Create a pattern canvas that is exactly one cell large
    const pCanvas = document.createElement("canvas");
    pCanvas.width = cellW;
    pCanvas.height = cellH;
    const pCtx = pCanvas.getContext("2d");
    
    if (!pCtx) return;

    pCtx.strokeStyle = color;
    pCtx.lineWidth = lw;

    // Draw top and left edges. When repeated, they form the full grid.
    // We use 0.5 offset if lw is odd for crisp lines, but since this is a pattern
    // and we might be zoomed, it's better to just draw.
    pCtx.beginPath();
    pCtx.moveTo(0, 0);
    pCtx.lineTo(cellW, 0);
    pCtx.moveTo(0, 0);
    pCtx.lineTo(0, cellH);
    pCtx.stroke();

    const dummyCtx = document.createElement("canvas").getContext("2d");
    if (dummyCtx) {
      this.pattern = dummyCtx.createPattern(pCanvas, "repeat");
      this.currentKey = key;
    }
  }
}
