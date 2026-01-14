import { GridGeometry } from "../models/canvas-geometry";
import { applyDashStyle } from "./render-utils";

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
    lineWidth: number,
    border: string
  ): void {
    this.ensurePattern(geom.cellW, geom.cellH, color, lineWidth);
    
    if (!this.pattern) {
      return;
    }

    const gridRect = geom.rectForCells(0, 0, geom.cols, geom.rows);
    
    targetCtx.save();
    this.clipToCanvas(targetCtx, canvasW, canvasH);
    this.drawPattern(targetCtx, geom, gridRect);
    this.drawBorders(targetCtx, geom, gridRect, color, lineWidth, border);
    targetCtx.restore();
  }

  private ensurePattern(cellW: number, cellH: number, color: string, lineWidth: number): void {
    const key = `${cellW}x${cellH}-${color}-${lineWidth}`;

    if (key !== this.currentKey || !this.pattern) {
      this.createPattern(cellW, cellH, color, lineWidth, key);
    }
  }

  private clipToCanvas(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    ctx.beginPath();
    ctx.rect(0, 0, canvasW, canvasH);
    ctx.clip();
  }

  private drawPattern(
    ctx: CanvasRenderingContext2D,
    geom: GridGeometry,
    gridRect: { x: number; y: number; w: number; h: number }
  ): void {
    if (!this.pattern) {
      return;
    }

    const startX = Math.round(gridRect.x);
    const startY = Math.round(gridRect.y);
    const endX = Math.round(gridRect.x + geom.cols * geom.cellW);
    const endY = Math.round(gridRect.y + geom.rows * geom.cellH);
    const totalW = endX - startX;
    const totalH = endY - startY;

    const roundedW = Math.round(geom.cellW);
    const roundedH = Math.round(geom.cellH);
    const scaleX = geom.cellW / roundedW;
    const scaleY = geom.cellH / roundedH;

    const matrix = new DOMMatrix().translate(startX, startY).scale(scaleX, scaleY);
    this.pattern.setTransform(matrix);

    ctx.fillStyle = this.pattern;
    ctx.fillRect(startX, startY, totalW, totalH);
  }

  private drawBorders(
    ctx: CanvasRenderingContext2D,
    geom: GridGeometry,
    gridRect: { x: number; y: number; w: number; h: number },
    color: string,
    lineWidth: number,
    border: string
  ): void {
    const lw = Math.max(1, Math.round(lineWidth * Math.min(geom.cellW, geom.cellH)));
    const offset = (lw % 2 === 1) ? 0.5 : 0;
    
    const startX = Math.round(gridRect.x);
    const startY = Math.round(gridRect.y);
    const endX = Math.round(gridRect.x + geom.cols * geom.cellW);
    const endY = Math.round(gridRect.y + geom.rows * geom.cellH);

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const borderStyle = border.toLowerCase();
    applyDashStyle(ctx, borderStyle, lineWidth);
    
    ctx.beginPath();
    ctx.moveTo(startX + offset, startY);
    ctx.lineTo(startX + offset, endY);
    ctx.moveTo(startX, startY + offset);
    ctx.lineTo(endX, startY + offset);
    ctx.moveTo(endX - offset, startY);
    ctx.lineTo(endX - offset, endY);
    ctx.moveTo(startX, endY - offset);
    ctx.lineTo(endX, endY - offset);
    ctx.stroke();
  }

  private createPattern(
    cellW: number,
    cellH: number,
    color: string,
    lineWidth: number,
    key: string
  ): void {
    this.pattern = null;
    const unit = Math.min(cellW, cellH);
    const lw = Math.max(1, Math.round(lineWidth * unit));
    
    const roundedW = Math.round(cellW);
    const roundedH = Math.round(cellH);

    if (!(roundedW >= 1 && roundedH >= 1)) return;

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
