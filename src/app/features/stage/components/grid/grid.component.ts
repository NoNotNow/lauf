import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { Point } from '../../../../core/models/point';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
import { Camera } from '../../../../core/rendering/camera';
import { GridGeometry } from '../../../../core/models/canvas-geometry';
import { GridBitmap } from '../../../../core/rendering/grid-bitmap';
import { ImageCache } from '../../../../core/rendering/image-cache';

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
  @Input() backgroundColor: string = 'transparent';
  @Input() backgroundImage: string = '';

  @Input() camera?: Camera;

  @ViewChild('layer')
  layer!: CanvasLayerComponent;

  // Changing this value forces CanvasLayer to redraw
  redrawKey = '';

  private bitmap = new GridBitmap();
  private imageCache = new ImageCache();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gridSize'] || changes['color'] || changes['lineWidth'] || changes['backgroundImage']) {
      this.updateRedrawKey();
      this.bitmap.invalidate();
    }
  }

  updateRedrawKey(): void {
    const N = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const M = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
    this.redrawKey = `${N}x${M}-${this.color}-${this.lineWidth}-${this.backgroundImage}`;
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
    // This ensures transparent fallback when image fails to load
    if (this.backgroundColor !== 'transparent' && (!this.backgroundImage || imageLoaded)) {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(gridRect.x, gridRect.y, gridRect.w, gridRect.h);
    }
    
    // Draw background image if provided and loaded (using cover strategy to maintain aspect ratio)
    if (imageLoaded && this.backgroundImage) {
      const img = this.imageCache.get(this.backgroundImage);
      if (img && img.complete && img.naturalWidth > 0) {
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
        
        ctx.save();
        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        ctx.restore();
      }
    }

    // Draw grid lines on top
    this.bitmap.draw(ctx, canvas.width, canvas.height, geom, this.color, this.lineWidth, this.gridBorder);
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
