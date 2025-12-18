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
    // Use floor/round to avoid subpixel gaps at the start
    const startX = Math.round(gridRect.x);
    const startY = Math.round(gridRect.y);
    
    // The total width/height should be exactly the sum of cell sizes, but we round the outer bounds
    const endX = Math.round(gridRect.x + geom.cols * geom.cellW);
    const endY = Math.round(gridRect.y + geom.rows * geom.cellH);
    const totalW = endX - startX;
    const totalH = endY - startY;

    // The pattern was created with rounded dimensions
    const roundedW = Math.round(geom.cellW);
    const roundedH = Math.round(geom.cellH);
    
    // We must scale the pattern to match the actual fractional cell size
    // We use the fractional geom.cellW to maintain the grid's internal consistency
    const scaleX = geom.cellW / roundedW;
    const scaleY = geom.cellH / roundedH;

    const matrix = new DOMMatrix().translate(startX, startY).scale(scaleX, scaleY);
    this.pattern.setTransform(matrix);

    targetCtx.fillStyle = this.pattern;
    // Fill the exact rounded area
    targetCtx.fillRect(startX, startY, totalW, totalH);

    // Draw the outermost borders manually to ensure they are crisp and present
    const lw = Math.max(1, Math.round(lineWidth * Math.min(geom.cellW, geom.cellH)));
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = lw;
    
    // For crisp outer borders, we should align them to half-pixels if lw is odd
    const offset = (lw % 2 === 1) ? 0.5 : 0;
    
    targetCtx.beginPath();
    // Top and Left edges
    targetCtx.moveTo(startX + offset, startY);
    targetCtx.lineTo(startX + offset, endY);
    targetCtx.moveTo(startX, startY + offset);
    targetCtx.lineTo(endX, startY + offset);
    
    // Bottom and Right edges
    // These must be precisely at endX/endY to match the pattern's right/bottom alignment
    targetCtx.moveTo(endX - offset, startY);
    targetCtx.lineTo(endX - offset, endY);
    targetCtx.moveTo(startX, endY - offset);
    targetCtx.lineTo(endX, endY - offset);
    targetCtx.stroke();

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
    
    const roundedW = Math.round(cellW);
    const roundedH = Math.round(cellH);

    const pCanvas = document.createElement("canvas");
    pCanvas.width = roundedW;
    pCanvas.height = roundedH;
    const pCtx = pCanvas.getContext("2d");
    
    if (!pCtx) return;

    pCtx.strokeStyle = color;
    pCtx.lineWidth = lw;

    // For crisp lines in the pattern, use the same half-pixel offset if lw is odd.
    // This ensures that the internal lines of the grid are also crisp.
    const offset = (lw % 2 === 1) ? 0.5 : 0;
    // We draw the rectangle such that it perfectly fits the pattern repeats.
    // The right and bottom edges should be at roundedW and roundedH to overlap with the next cell's left/top.
    pCtx.strokeRect(offset, offset, roundedW, roundedH);

    const dummyCtx = document.createElement("canvas").getContext("2d");
    if (dummyCtx) {
      this.pattern = dummyCtx.createPattern(pCanvas, "repeat");
      this.currentKey = key;
    }
  }
}
