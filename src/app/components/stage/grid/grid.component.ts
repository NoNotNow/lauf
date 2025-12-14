import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Point } from '../../../models/point';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss'
})
export class GridComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // Number of cells to display across each axis
  // Use Point: x = columns, y = rows
  @Input() size: Point = new Point(10, 10);

  // Grid line color and width (width in CSS pixels; DPR-adjusted for crispness)
  @Input() color: string = '#cccccc';
  @Input() lineWidth: number = 1;

  private resizeObserver?: ResizeObserver;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    // Observe size changes of the host to keep the canvas in sync
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.host.nativeElement);
    // Initial sync
    this.resizeCanvas();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['size'] || changes['color'] || changes['lineWidth']) {
      // Redraw with the new grid size if the canvas is already available
      if (this.canvasRef?.nativeElement) {
        this.draw();
      }
    }
  }

  private resizeCanvas(): void {
    const el = this.host.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set CSS size so it fills the host
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Set actual pixel size for crisp rendering on HiDPI screens
    const displayWidth = Math.max(1, Math.floor(rect.width * dpr));
    const displayHeight = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    this.draw();
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    const lw = Math.max(1, Math.round(this.lineWidth * dpr));
    const offset = (lw % 2 === 1) ? 0.5 : 0.0;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = lw;

    const w = canvas.width;
    const h = canvas.height;

    // Draw border lines exactly on the first and last pixel columns/rows
    // Align to 0.5 for odd device-pixel line widths, or 0 for even widths
    ctx.beginPath();
    // Left border
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, h);
    // Right border
    ctx.moveTo(w - offset, 0);
    ctx.lineTo(w - offset, h);
    // Top border
    ctx.moveTo(0, offset);
    ctx.lineTo(w, offset);
    // Bottom border
    ctx.moveTo(0, h - offset);
    ctx.lineTo(w, h - offset);
    ctx.stroke();

    // Determine number of cells (must be >= 1 to have a valid grid)
    // N: columns (vertical lines split), M: rows (horizontal lines split)
    const N = Math.max(1, Math.floor(this.size?.x ?? 1));
    const M = Math.max(1, Math.floor(this.size?.y ?? 1));

    // If only 1 cell, there are no inner lines; just borders. For N > 1, draw N-1 inner lines.
    if (N > 1) {
      // We want exactly N cells between borders. Borders are at x=0.5 and x=w-0.5 (similarly for y).
      // Place inner lines at proportional positions snapped to device pixels to maintain crispness.
      // Use (w - 1) because the distance between the two border centers is exactly (w - 1) pixels for odd lw alignment.
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
