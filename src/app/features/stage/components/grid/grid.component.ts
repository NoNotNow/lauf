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
        // Fallback to legacy drawing if geom is missing (should not happen with new CanvasLayer)
        this.drawLegacy(ctx, canvas);
        return;
    }

    // Get visible viewport bounds - only render what's actually visible
    let visibleRect = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    if (this.camera) {
      const viewportBounds = this.camera.getViewportBounds(geom.cols, geom.rows);
      if (viewportBounds) {
        // Convert viewport bounds (in cell coordinates) to screen coordinates
        const topLeft = geom.rectForCells(viewportBounds.minX, viewportBounds.minY, 0, 0);
        const bottomRight = geom.rectForCells(viewportBounds.maxX, viewportBounds.maxY, 0, 0);
        visibleRect = {
          x: topLeft.x,
          y: topLeft.y,
          w: bottomRight.x - topLeft.x,
          h: bottomRight.y - topLeft.y
        };
        // Add small margin to avoid edge artifacts
        const margin = 50;
        visibleRect.x -= margin;
        visibleRect.y -= margin;
        visibleRect.w += margin * 2;
        visibleRect.h += margin * 2;
      }
    }

    // Get full grid rect for reference (but we'll only render visible portion)
    const gridRect = geom.rectForCells(0, 0, geom.cols, geom.rows);
    
    // Check if background image is specified and if it loads successfully
    let imageLoaded = false;
    if (this.backgroundImage) {
      const img = this.imageCache.get(this.backgroundImage);
      if (img && img.complete && img.naturalWidth > 0) {
        imageLoaded = true;
      }
    }
    
    // Only draw background color if no image is specified, or if image is specified and successfully loaded
    // Fill only the visible area for performance
    if (this.backgroundColor !== 'transparent' && (!this.backgroundImage || imageLoaded)) {
      ctx.fillStyle = this.backgroundColor;
      // Clip to visible area to avoid unnecessary fills
      ctx.save();
      ctx.beginPath();
      ctx.rect(visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h);
      ctx.clip();
      ctx.fillRect(gridRect.x, gridRect.y, gridRect.w, gridRect.h);
      ctx.restore();
    }
    
    // Draw background image if provided and loaded
    if (imageLoaded && this.backgroundImage) {
      const img = this.imageCache.get(this.backgroundImage);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        
        // Clip to visible area to avoid rendering off-screen tiles
        ctx.beginPath();
        ctx.rect(visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h);
        ctx.clip();
        
        // Check if background repeat is configured
        if (this.backgroundRepeat && this.backgroundRepeat.Mode !== 'no-repeat') {
          // Use pre-rendered pattern for efficient tiling
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
        } else {
          // Default cover strategy (maintain aspect ratio, cover entire area)
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const gridAspect = gridRect.w / gridRect.h;
          
          // Calculate scale to cover (use larger scale to ensure full coverage)
          const scale = imgAspect > gridAspect 
            ? gridRect.h / img.naturalHeight  // Image is wider, scale by height
            : gridRect.w / img.naturalWidth;   // Image is taller, scale by width
          
          const scaledWidth = img.naturalWidth * scale;
          const scaledHeight = img.naturalHeight * scale;
          
          // Center the image
          const offsetX = gridRect.x + (gridRect.w - scaledWidth) / 2;
          const offsetY = gridRect.y + (gridRect.h - scaledHeight) / 2;
          
          ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        }
        
        ctx.restore();
      }
    }

    // Draw grid lines on top (only if grid is active)
    // Early exit: skip grid drawing entirely if Border.Active is false
    if (this.gridBorderActive) {
      this.bitmap.draw(ctx, canvas.width, canvas.height, geom, this.color, this.lineWidth, this.gridBorder);
    }
  };

  private drawLegacy(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const w = canvas.width;
    const h = canvas.height;
    const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));

    const cellW = w / N;
    const cellH = h / M;
    const unit = Math.min(cellW, cellH);
    const lw = Math.max(1, Math.round((this.lineWidth ?? 0) * unit));
    const offset = (lw % 2 === 1) ? 0.5 : 0.0;
    if( this.backgroundColor !== 'transparent' ) {
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, w, h);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = lw;

    // Borders
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, h);
    ctx.moveTo(w - offset, 0);
    ctx.lineTo(w - offset, h);
    ctx.moveTo(0, offset);
    ctx.lineTo(w, offset);
    ctx.moveTo(0, h - offset);
    ctx.lineTo(w, h - offset);
    ctx.stroke();

    if (N > 1) {
      for (let i = 1; i < N; i++) {
        const x = offset + Math.round((i * (w - 1)) / N);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let i = 1; i < M; i++) {
        const y = offset + Math.round((i * (h - 1)) / M);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
  }
}
