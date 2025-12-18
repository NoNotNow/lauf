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

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.host.nativeElement);
    this.resizeCanvas();
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
    this.drawNow();
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
    }

    this.drawNow();
  }

  private drawNow(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear before delegating
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Build geometry helper if gridSize is provided
    const cols = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const rows = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    let geom: GridGeometry = {
      cols,
      rows,
      cellW,
      cellH,
      rectForCells: (col: number, row: number, wCells: number = 1, hCells: number = 1, padRatio: number = 0) => {
        const minSide = cellW < cellH ? cellW : cellH;
        const pad = padRatio > 0 ? (minSide * (padRatio > 0.5 ? 0.5 : padRatio)) : 0;
        const x = col * cellW + pad;
        const y = row * cellH + pad;
        const w = wCells * cellW - 2 * pad;
        const h = hCells * cellH - 2 * pad;
        return { x, y, w: w < 0 ? 0 : w, h: h < 0 ? 0 : h };
      }
    };

    if (this.camera) {
      geom = this.camera.transformGeometry(geom, canvas.width, canvas.height);
    }

    this.draw?.(ctx, canvas, geom);
  }
}
