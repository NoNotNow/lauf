import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { Point } from '../../../../core/models/point';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
import { Camera } from '../../../../core/rendering/camera';
import { GridGeometry } from '../../../../core/models/canvas-geometry';
import { GridBitmap } from '../../../../core/rendering/grid-bitmap';
import { ImageCache } from '../../../../core/rendering/image-cache';
import { BackgroundPattern } from '../../../../core/rendering/background-pattern';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [CanvasLayerComponent],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss'
})
export class GridComponent implements OnChanges {
  // Number of cells to display across each axis
  // Use Point: x = columns, y = rows
  @Input() gridSize: Point = new Point(10, 10);

  // Grid line color and width (width in cell units; 1.0 == one cell thickness)
  @Input() color: string = '#cccccc';
  @Input() lineWidth: number = 0.02;
  @Input() gridBorder!: string;
  @Input() gridBorderActive: boolean = true; // If false, grid lines are not drawn
  @Input() backgroundColor: string = 'transparent';
  @Input() backgroundImage: string = '';
  @Input() backgroundRepeat: { Mode: string, TileSize: { X: number, Y: number } } | null = null;

  @Input() camera?: Camera;

  @ViewChild('layer')
  layer!: CanvasLayerComponent;

  // Changing this value forces CanvasLayer to redraw
  redrawKey = '';

  private bitmap = new GridBitmap();
  private imageCache = new ImageCache();
  private backgroundPattern = new BackgroundPattern();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gridSize'] || changes['color'] || changes['lineWidth'] || changes['backgroundImage'] || changes['backgroundRepeat']) {
      this.updateRedrawKey();
      this.bitmap.invalidate();
      this.backgroundPattern.invalidate();
    }
    // If camera is set for the first time and is dirty, trigger initial redraw
    if (changes['camera'] && this.camera?.isDirty) {
      this.requestRedraw();
    }
  }

  updateRedrawKey(): void {
    const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
    const bgRepeatKey = this.backgroundRepeat ? `${this.backgroundRepeat.Mode}-${this.backgroundRepeat.TileSize.X}-${this.backgroundRepeat.TileSize.Y}` : 'none';
    this.redrawKey = `${N}x${M}-${this.color}-${this.lineWidth}-${this.backgroundImage}-${bgRepeatKey}`;
  }

  requestRedraw(): void {
    this.layer?.requestRedraw();
  }

  // Draw callback used by CanvasLayerComponent
  drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, geom?: GridGeometry) => {
    if (!geom) {
      return;
    }

    const visibleRect = this.calculateVisibleRect(canvas, geom);
    const gridRect = geom.rectForCells(0, 0, geom.cols, geom.rows);
    
    this.drawBackgroundColor(ctx, visibleRect, gridRect);
    this.drawBackgroundImage(ctx, canvas, geom, visibleRect, gridRect);
    this.drawGridLines(ctx, canvas, geom);
  };

  private calculateVisibleRect(canvas: HTMLCanvasElement, geom: GridGeometry): { x: number; y: number; w: number; h: number } {
    let visibleRect = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    
    if (!this.camera) {
      return visibleRect;
    }

    const viewportBounds = this.camera.getViewportBounds(geom.cols, geom.rows);
    if (!viewportBounds) {
      return visibleRect;
    }

    const topLeft = geom.rectForCells(viewportBounds.minX, viewportBounds.minY, 0, 0);
    const bottomRight = geom.rectForCells(viewportBounds.maxX, viewportBounds.maxY, 0, 0);
    visibleRect = {
      x: topLeft.x,
      y: topLeft.y,
      w: bottomRight.x - topLeft.x,
      h: bottomRight.y - topLeft.y
    };

    const margin = 50;
    visibleRect.x -= margin;
    visibleRect.y -= margin;
    visibleRect.w += margin * 2;
    visibleRect.h += margin * 2;

    return visibleRect;
  }

  private isImageLoaded(): boolean {
    if (!this.backgroundImage) {
      return false;
    }
    const img = this.imageCache.get(this.backgroundImage);
    return img !== null && img.complete && img.naturalWidth > 0;
  }

  private drawBackgroundColor(
    ctx: CanvasRenderingContext2D,
    visibleRect: { x: number; y: number; w: number; h: number },
    gridRect: { x: number; y: number; w: number; h: number }
  ): void {
    const imageLoaded = this.isImageLoaded();
    const shouldDrawColor = this.backgroundColor !== 'transparent' && (!this.backgroundImage || imageLoaded);
    
    if (!shouldDrawColor) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h);
    ctx.clip();
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(gridRect.x, gridRect.y, gridRect.w, gridRect.h);
    ctx.restore();
  }

  private drawBackgroundImage(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    geom: GridGeometry,
    visibleRect: { x: number; y: number; w: number; h: number },
    gridRect: { x: number; y: number; w: number; h: number }
  ): void {
    if (!this.isImageLoaded() || !this.backgroundImage) {
      return;
    }

    const img = this.imageCache.get(this.backgroundImage);
    if (!img || !img.complete || img.naturalWidth === 0) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h);
    ctx.clip();

    const hasRepeatMode = this.backgroundRepeat && this.backgroundRepeat.Mode !== 'no-repeat';
    if (hasRepeatMode) {
      this.drawBackgroundImageTiled(ctx, canvas, geom, img, gridRect, visibleRect);
    } else {
      this.drawBackgroundImageCover(ctx, img, gridRect);
    }

    ctx.restore();
  }

  private drawBackgroundImageTiled(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    geom: GridGeometry,
    img: HTMLImageElement,
    gridRect: { x: number; y: number; w: number; h: number },
    visibleRect: { x: number; y: number; w: number; h: number }
  ): void {
    if (!this.backgroundRepeat) {
      return;
    }

    const tileSizeX = Math.max(0.1, this.backgroundRepeat.TileSize.X);
    const tileSizeY = Math.max(0.1, this.backgroundRepeat.TileSize.Y);
    
    this.backgroundPattern.draw(
      ctx,
      canvas.width,
      canvas.height,
      geom,
      img,
      tileSizeX,
      tileSizeY,
      this.backgroundRepeat.Mode,
      gridRect,
      visibleRect
    );
  }

  private drawBackgroundImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    gridRect: { x: number; y: number; w: number; h: number }
  ): void {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const gridAspect = gridRect.w / gridRect.h;
    
    const scale = imgAspect > gridAspect 
      ? gridRect.h / img.naturalHeight
      : gridRect.w / img.naturalWidth;
    
    const scaledWidth = img.naturalWidth * scale;
    const scaledHeight = img.naturalHeight * scale;
    const offsetX = gridRect.x + (gridRect.w - scaledWidth) / 2;
    const offsetY = gridRect.y + (gridRect.h - scaledHeight) / 2;
    
    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
  }

  private drawGridLines(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    geom: GridGeometry
  ): void {
    if (!this.gridBorderActive) {
      return;
    }

    this.bitmap.draw(ctx, canvas.width, canvas.height, geom, this.color, this.lineWidth, this.gridBorder);
  }
}
