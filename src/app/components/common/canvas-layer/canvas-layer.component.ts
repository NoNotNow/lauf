import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnChanges, SimpleChanges, ViewChild } from '@angular/core';

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
  @Input() draw?: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void;

  // Any change to this input triggers a redraw
  @Input() redrawKey: unknown;

  private resizeObserver?: ResizeObserver;

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
    this.draw?.(ctx, canvas);
  }
}
