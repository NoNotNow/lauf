import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { Point } from '../../../models/point';

@Component({
  selector: 'app-obstacles',
  standalone: true,
  imports: [],
  templateUrl: './obstacles.component.html',
  styleUrl: './obstacles.component.scss'
})
export class ObstaclesComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() size: Point = new Point(10, 10); // x: cols, y: rows
  @Input() color: string = 'rgba(200,0,0,0.6)';

  private resizeObserver?: ResizeObserver;
  private obstacles = new Set<string>();

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.host.nativeElement);
    this.resizeCanvas();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['size'] || changes['color']) {
      if (this.canvasRef?.nativeElement) {
        this.draw();
      }
    }
  }

  // Public API: set or clear an obstacle at a grid point
  setObstacle(point: Point, present: boolean = true): void {
    const key = this.key(point.x, point.y);
    if (present) this.obstacles.add(key); else this.obstacles.delete(key);
    this.draw();
  }

  clearAll(): void {
    this.obstacles.clear();
    this.draw();
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x)},${Math.floor(y)}`;
  }

  private resizeCanvas(): void {
    const el = this.host.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

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

    const cols = Math.max(1, Math.floor(this.size?.x ?? 1));
    const rows = Math.max(1, Math.floor(this.size?.y ?? 1));
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    ctx.fillStyle = this.color;

    // Draw each obstacle as a filled rect inside its cell with small padding
    const pad = Math.max(0, Math.min(cellW, cellH) * 0.08);
    for (const key of this.obstacles) {
      const [sx, sy] = key.split(',').map(n => parseInt(n, 10));
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue;
      const x = sx * cellW + pad;
      const y = sy * cellH + pad;
      const w = Math.max(0, cellW - 2 * pad);
      const h = Math.max(0, cellH - 2 * pad);
      ctx.fillRect(x, y, w, h);
    }
  }
}
