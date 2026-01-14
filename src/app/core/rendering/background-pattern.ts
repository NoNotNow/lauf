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
    if (!this.isValidImage(sourceImage)) {
      return;
    }

    const mode = repeatMode.toLowerCase();
    if (this.isNoRepeatMode(mode)) {
      return;
    }

    const tilePxW = this.calculateTileSizeInPixels(tileSizeX, geom.cellW);
    const tilePxH = this.calculateTileSizeInPixels(tileSizeY, geom.cellH);

    if (!this.isValidTileSize(tilePxW, tilePxH)) {
      return;
    }

    this.ensurePattern(sourceImage, tilePxW, tilePxH, mode);

    if (!this.pattern) {
      return;
    }

    this.drawPatternToContext(targetCtx, geom, gridRect, visibleRect);
  }

  private isValidImage(sourceImage: HTMLImageElement | null): boolean {
    return sourceImage !== null && sourceImage.complete && sourceImage.naturalWidth > 0;
  }

  private isNoRepeatMode(mode: string): boolean {
    return mode === 'no-repeat';
  }

  private calculateTileSizeInPixels(tileSizeInCells: number, cellSizeInPixels: number): number {
    return Math.round(tileSizeInCells * cellSizeInPixels);
  }

  private isValidTileSize(tilePxW: number, tilePxH: number): boolean {
    return tilePxW > 0 && tilePxH > 0;
  }

  private ensurePattern(
    sourceImage: HTMLImageElement,
    tilePxW: number,
    tilePxH: number,
    mode: string
  ): void {
    const key = this.createCacheKey(tilePxW, tilePxH, sourceImage.src, mode);

    if (this.shouldRegeneratePattern(key, sourceImage)) {
      this.createPattern(sourceImage, tilePxW, tilePxH, mode, key);
    }
  }

  private createCacheKey(tilePxW: number, tilePxH: number, imageSrc: string, mode: string): string {
    return `${tilePxW}x${tilePxH}-${imageSrc}-${mode}`;
  }

  private shouldRegeneratePattern(key: string, sourceImage: HTMLImageElement): boolean {
    return key !== this.currentKey || !this.pattern || this.sourceImage !== sourceImage;
  }

  private drawPatternToContext(
    targetCtx: CanvasRenderingContext2D,
    geom: GridGeometry,
    gridRect: { x: number; y: number; w: number; h: number },
    visibleRect: { x: number; y: number; w: number; h: number }
  ): void {
    if (!this.pattern) {
      return;
    }

    targetCtx.save();
    this.clipToVisibleArea(targetCtx, visibleRect);
    this.applyPatternTransform(targetCtx, geom, gridRect);
    this.fillGridAreaWithPattern(targetCtx, geom, gridRect);
    targetCtx.restore();
  }

  private clipToVisibleArea(
    ctx: CanvasRenderingContext2D,
    visibleRect: { x: number; y: number; w: number; h: number }
  ): void {
    ctx.beginPath();
    ctx.rect(visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h);
    ctx.clip();
  }

  private applyPatternTransform(
    ctx: CanvasRenderingContext2D,
    geom: GridGeometry,
    gridRect: { x: number; y: number; w: number; h: number }
  ): void {
    if (!this.pattern) {
      return;
    }

    const gridStartX = Math.round(gridRect.x);
    const gridStartY = Math.round(gridRect.y);
    const matrix = new DOMMatrix().translate(gridStartX, gridStartY);
    this.pattern.setTransform(matrix);
  }

  private fillGridAreaWithPattern(
    ctx: CanvasRenderingContext2D,
    geom: GridGeometry,
    gridRect: { x: number; y: number; w: number; h: number }
  ): void {
    if (!this.pattern) {
      return;
    }

    const gridStartX = Math.round(gridRect.x);
    const gridStartY = Math.round(gridRect.y);
    const endX = Math.round(gridRect.x + geom.cols * geom.cellW);
    const endY = Math.round(gridRect.y + geom.rows * geom.cellH);
    const totalW = endX - gridStartX;
    const totalH = endY - gridStartY;

    ctx.fillStyle = this.pattern;
    ctx.fillRect(gridStartX, gridStartY, totalW, totalH);
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

    const roundedW = Math.max(1, Math.round(tilePxW));
    const roundedH = Math.max(1, Math.round(tilePxH));

    const tileCanvas = this.createTileCanvas(roundedW, roundedH);
    const tileCtx = this.getTileContext(tileCanvas);

    if (!tileCtx) {
      return;
    }

    tileCtx.clearRect(0, 0, roundedW, roundedH);

    const imageDimensions = this.calculateImageDimensionsForRepeatMode(
      sourceImage,
      roundedW,
      roundedH,
      mode
    );

    tileCtx.drawImage(
      sourceImage,
      imageDimensions.offsetX,
      imageDimensions.offsetY,
      imageDimensions.drawW,
      imageDimensions.drawH
    );

    this.createPatternFromTile(tileCanvas, key);
  }

  private createTileCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
    const isFirefox = this.isFirefoxBrowser();

    if (!isFirefox && typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private isFirefoxBrowser(): boolean {
    return typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent);
  }

  private getTileContext(
    tileCanvas: OffscreenCanvas | HTMLCanvasElement
  ): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null {
    const ctx = tileCanvas.getContext("2d");
    if (ctx && ('fillStyle' in ctx)) {
      return ctx as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
    }
    return null;
  }

  private calculateImageDimensionsForRepeatMode(
    sourceImage: HTMLImageElement,
    tileWidth: number,
    tileHeight: number,
    mode: string
  ): { drawW: number; drawH: number; offsetX: number; offsetY: number } {
    if (mode === 'repeat-x') {
      return this.calculateRepeatXDimensions(sourceImage, tileWidth, tileHeight);
    }

    if (mode === 'repeat-y') {
      return this.calculateRepeatYDimensions(sourceImage, tileWidth, tileHeight);
    }

    return this.calculateFullRepeatDimensions(sourceImage, tileWidth, tileHeight);
  }

  private calculateRepeatXDimensions(
    sourceImage: HTMLImageElement,
    tileWidth: number,
    tileHeight: number
  ): { drawW: number; drawH: number; offsetX: number; offsetY: number } {
    const drawH = tileHeight;
    const drawW = sourceImage.naturalWidth * (drawH / sourceImage.naturalHeight);
    const offsetX = (tileWidth - drawW) / 2;
    const offsetY = 0;

    return { drawW, drawH, offsetX, offsetY };
  }

  private calculateRepeatYDimensions(
    sourceImage: HTMLImageElement,
    tileWidth: number,
    tileHeight: number
  ): { drawW: number; drawH: number; offsetX: number; offsetY: number } {
    const drawW = tileWidth;
    const drawH = sourceImage.naturalHeight * (drawW / sourceImage.naturalWidth);
    const offsetX = 0;
    const offsetY = (tileHeight - drawH) / 2;

    return { drawW, drawH, offsetX, offsetY };
  }

  private calculateFullRepeatDimensions(
    sourceImage: HTMLImageElement,
    tileWidth: number,
    tileHeight: number
  ): { drawW: number; drawH: number; offsetX: number; offsetY: number } {
    const imgAspect = sourceImage.naturalWidth / sourceImage.naturalHeight;
    const tileAspect = tileWidth / tileHeight;

    if (imgAspect > tileAspect) {
      return this.calculateWiderImageDimensions(sourceImage, tileWidth, tileHeight);
    }

    return this.calculateTallerImageDimensions(sourceImage, tileWidth, tileHeight);
  }

  private calculateWiderImageDimensions(
    sourceImage: HTMLImageElement,
    tileWidth: number,
    tileHeight: number
  ): { drawW: number; drawH: number; offsetX: number; offsetY: number } {
    const drawH = tileHeight;
    const drawW = sourceImage.naturalWidth * (drawH / sourceImage.naturalHeight);
    const offsetX = (tileWidth - drawW) / 2;
    const offsetY = 0;

    return { drawW, drawH, offsetX, offsetY };
  }

  private calculateTallerImageDimensions(
    sourceImage: HTMLImageElement,
    tileWidth: number,
    tileHeight: number
  ): { drawW: number; drawH: number; offsetX: number; offsetY: number } {
    const drawW = tileWidth;
    const drawH = sourceImage.naturalHeight * (drawW / sourceImage.naturalWidth);
    const offsetX = 0;
    const offsetY = (tileHeight - drawH) / 2;

    return { drawW, drawH, offsetX, offsetY };
  }

  private createPatternFromTile(
    tileCanvas: OffscreenCanvas | HTMLCanvasElement,
    key: string
  ): void {
    const dummyCtx = document.createElement("canvas").getContext("2d");
    if (dummyCtx) {
      this.pattern = dummyCtx.createPattern(tileCanvas as HTMLCanvasElement, "repeat");
      this.currentKey = key;
    }
  }
}

