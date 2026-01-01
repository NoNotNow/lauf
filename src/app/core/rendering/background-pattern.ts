import { GridGeometry } from "../models/canvas-geometry";

/**
 * Pre-renders a background image into a tiled pattern for efficient rendering.
 * Similar to GridBitmap, but for background images instead of grid lines.
 * This avoids repeated SVG rendering and scales better than drawing individual tiles.
 */
export class BackgroundPattern {
  private pattern: CanvasPattern | null = null;
  private currentKey = "";
  private sourceImage: HTMLImageElement | null = null;

  invalidate(): void {
    this.currentKey = "";
    this.pattern = null;
    this.sourceImage = null;
  }

  /**
   * Draws the tiled background pattern to the target context.
   * @param targetCtx Target canvas context
   * @param canvasW Canvas width
   * @param canvasH Canvas height
   * @param geom Grid geometry
   * @param sourceImage Source image to tile
   * @param tileSizeX Tile size in grid cells (X axis)
   * @param tileSizeY Tile size in grid cells (Y axis)
   * @param repeatMode 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'
   * @param gridRect Full grid rectangle in screen coordinates
   * @param visibleRect Visible viewport rectangle in screen coordinates
   */
  draw(
    targetCtx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    geom: GridGeometry,
    sourceImage: HTMLImageElement | null,
    tileSizeX: number,
    tileSizeY: number,
    repeatMode: string,
    gridRect: { x: number; y: number; w: number; h: number },
    visibleRect: { x: number; y: number; w: number; h: number }
  ): void {
    if (!sourceImage || !sourceImage.complete || sourceImage.naturalWidth === 0) {
      return;
    }

    const mode = repeatMode.toLowerCase();
    
    // For no-repeat, fall back to single drawImage (no pattern needed)
    if (mode === 'no-repeat') {
      return;
    }

    // Calculate tile size in pixels
    const tilePxW = Math.round(tileSizeX * geom.cellW);
    const tilePxH = Math.round(tileSizeY * geom.cellH);

    if (tilePxW <= 0 || tilePxH <= 0) {
      return;
    }

    // Create cache key based on tile size and image
    const key = `${tilePxW}x${tilePxH}-${sourceImage.src}-${mode}`;

    // Regenerate pattern if needed
    if (key !== this.currentKey || !this.pattern || this.sourceImage !== sourceImage) {
      this.createPattern(sourceImage, tilePxW, tilePxH, mode, key);
    }

    if (!this.pattern) return;

    targetCtx.save();

    // Clip to visible area
    targetCtx.beginPath();
    targetCtx.rect(visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h);
    targetCtx.clip();

    // Align pattern to grid origin
    const gridStartX = Math.round(gridRect.x);
    const gridStartY = Math.round(gridRect.y);
    const endX = Math.round(gridRect.x + geom.cols * geom.cellW);
    const endY = Math.round(gridRect.y + geom.rows * geom.cellH);
    const totalW = endX - gridStartX;
    const totalH = endY - gridStartY;

    // Set pattern transform to align with grid
    const matrix = new DOMMatrix().translate(gridStartX, gridStartY);
    this.pattern.setTransform(matrix);

    targetCtx.fillStyle = this.pattern;
    // Fill the grid area (pattern will tile automatically)
    targetCtx.fillRect(gridStartX, gridStartY, totalW, totalH);

    targetCtx.restore();
  }

  /**
   * Creates a CanvasPattern from the source image at the specified tile size.
   * Pre-renders the image into a bitmap tile for efficient tiling.
   */
  private createPattern(
    sourceImage: HTMLImageElement,
    tilePxW: number,
    tilePxH: number,
    mode: string,
    key: string
  ): void {
    this.pattern = null;
    this.sourceImage = sourceImage;

    // Round tile dimensions to integers
    const roundedW = Math.max(1, Math.round(tilePxW));
    const roundedH = Math.max(1, Math.round(tilePxH));

    // Create offscreen canvas for the tile
    const isFirefox = typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent);
    let tileCanvas: OffscreenCanvas | HTMLCanvasElement;
    let tileCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

    // Use HTMLCanvasElement on Firefox for better performance
    if (!isFirefox && typeof OffscreenCanvas !== "undefined") {
      tileCanvas = new OffscreenCanvas(roundedW, roundedH);
      tileCtx = tileCanvas.getContext("2d");
    } else {
      const el = document.createElement("canvas");
      el.width = roundedW;
      el.height = roundedH;
      tileCanvas = el;
      tileCtx = el.getContext("2d");
    }

    if (!tileCtx) return;

    // Clear the tile canvas
    tileCtx.clearRect(0, 0, roundedW, roundedH);

    // Draw the source image scaled to tile size
    // This pre-renders the SVG/bitmap into a raster tile
    const imgAspect = sourceImage.naturalWidth / sourceImage.naturalHeight;
    const tileAspect = roundedW / roundedH;

    let drawW: number;
    let drawH: number;
    let offsetX: number;
    let offsetY: number;

    // Handle different repeat modes
    if (mode === 'repeat-x') {
      // Only repeat horizontally - scale to tile height, center horizontally
      drawH = roundedH;
      drawW = sourceImage.naturalWidth * (drawH / sourceImage.naturalHeight);
      offsetX = (roundedW - drawW) / 2;
      offsetY = 0;
    } else if (mode === 'repeat-y') {
      // Only repeat vertically - scale to tile width, center vertically
      drawW = roundedW;
      drawH = sourceImage.naturalHeight * (drawW / sourceImage.naturalWidth);
      offsetX = 0;
      offsetY = (roundedH - drawH) / 2;
    } else {
      // Full repeat - scale to cover tile (maintain aspect ratio)
      if (imgAspect > tileAspect) {
        // Image is wider - scale by height
        drawH = roundedH;
        drawW = sourceImage.naturalWidth * (drawH / sourceImage.naturalHeight);
        offsetX = (roundedW - drawW) / 2;
        offsetY = 0;
      } else {
        // Image is taller - scale by width
        drawW = roundedW;
        drawH = sourceImage.naturalHeight * (drawW / sourceImage.naturalWidth);
        offsetX = 0;
        offsetY = (roundedH - drawH) / 2;
      }
    }

    // Draw the image into the tile canvas (pre-rendering the SVG/bitmap)
    tileCtx.drawImage(sourceImage, offsetX, offsetY, drawW, drawH);

    // Create pattern from the pre-rendered tile
    const dummyCtx = document.createElement("canvas").getContext("2d");
    if (dummyCtx) {
      this.pattern = dummyCtx.createPattern(tileCanvas as HTMLCanvasElement, "repeat");
      this.currentKey = key;
    }
  }
}

