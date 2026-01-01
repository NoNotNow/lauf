import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { Point } from '../../../../core/models/point';
import { GridGeometry } from '../../../../core/models/canvas-geometry';
import { Camera } from '../../../../core/rendering/camera';

@Component({
  selector: 'app-canvas-layer',
  standalone: true,
  templateUrl: './canvas-layer.component.html',
  styleUrl: './canvas-layer.component.scss'
})
export class CanvasLayerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // Draw callback provided by parent components
  @Input() draw?: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, geom?: GridGeometry) => void;

  // Any change to this input triggers a redraw
  @Input() redrawKey: unknown;

  // Optional grid size for geometry computation (x: cols, y: rows)
  @Input() gridSize?: Point;

  @Input() camera?: Camera;

  private resizeObserver?: ResizeObserver;
  private onExternalRedraw = () => this.drawNow();
  // Cache canvas context to avoid repeated getContext() calls (Firefox optimization)
  private cachedCtx?: CanvasRenderingContext2D | null;
  // Batch redraws to avoid multiple redraws in the same frame (Firefox optimization)
  private redrawScheduled = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.host.nativeElement);
    setTimeout(() => {
      this.resizeCanvas();
    }, 100);
    // Listen for global redraw events (e.g., image assets loaded)
    window.addEventListener('app-canvas-redraw', this.onExternalRedraw);
    
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    window.removeEventListener('app-canvas-redraw', this.onExternalRedraw);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['redrawKey'] && this.canvasRef?.nativeElement) {
      this.drawNow();
    }
  }

  requestRedraw(): void {
    // Batch redraws using requestAnimationFrame to avoid multiple redraws per frame
    // This is especially important for Firefox performance
    if (!this.redrawScheduled) {
      this.redrawScheduled = true;
      requestAnimationFrame(() => {
        this.redrawScheduled = false;
        this.drawNow();
      });
    }
  }

  private resizeCanvas(): void {
    const el = this.host.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // CSS size
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Backing store size
    const displayWidth = Math.max(1, Math.floor(rect.width * dpr));
    const displayHeight = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      // Invalidate cached context when canvas size changes
      this.cachedCtx = null;
    }

    if (this.camera) {
      this.camera.setAspectRatio(canvas.width / canvas.height);
    }

    this.drawNow();
  }

  private drawNow(): void {
    const canvas = this.canvasRef.nativeElement;
    // Cache context to avoid repeated getContext() calls (Firefox optimization)
    // Use willReadFrequently: false for better performance (we don't read pixels)
    if (!this.cachedCtx) {
      this.cachedCtx = canvas.getContext('2d', { 
        alpha: true,
        willReadFrequently: false  // Firefox optimization: faster if we don't read pixels
      });
    }
    const ctx = this.cachedCtx;
    if (!ctx) return;

    // Clear before delegating
    // Note: clearRect can be slower in Firefox, but it's necessary for proper alpha blending
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Build geometry helper if gridSize is provided
    const cols = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const rows = Math.max(1, Math.floor(this.gridSize?.y ?? 1));

    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    const cellSize = Math.min(cellW, cellH); // Shrink to fit the tighter dimension

    // Default centering offsets for the base geometry
    const offsetX = (canvas.width - cols * cellSize) / 2;
    const offsetY = (canvas.height - rows * cellSize) / 2;

    let geom: GridGeometry = {
      cols,
      rows,
      cellW: cellSize,
      cellH: cellSize,
      rectForCells: (col: number, row: number, wCells: number = 1, hCells: number = 1, padRatio: number = 0) => {
        const pad = padRatio > 0 ? (cellSize * (padRatio > 0.5 ? 0.5 : padRatio)) : 0;
        const x = col * cellSize + pad + offsetX;
        const y = row * cellSize + pad + offsetY;
        const w = wCells * cellSize - 2 * pad;
        const h = hCells * cellSize - 2 * pad;
        return { x, y, w: w < 0 ? 0 : w, h: h < 0 ? 0 : h };
      }
    };

    if (this.camera) {
      // The camera transformation will override rectForCells with its own centering logic
      geom = this.camera.transformGeometry(geom, canvas.width, canvas.height);
    }

    this.draw?.(ctx, canvas, geom);
  }
}
