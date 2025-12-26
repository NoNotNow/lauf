import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject, animationFrames, interval, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

// Ticks an observable on every animation frame (requestAnimationFrame),
// with an optional FPS cap fallback when rAF is not desired.
@Injectable({ providedIn: 'root' })
export class TickService {
  private running = false;
  private sub?: Subscription;
  private _ticks$ = new Subject<{ time: number; frame: number; dtSec: number }>();
  private frame = 0;
  private lastTime = 0;
  private tickObject = { time: 0, frame: 0, dtSec: 0 }; // Reusable object to avoid allocation per frame

  constructor(private zone: NgZone) {}

  get ticks$(): Observable<{ time: number; frame: number; dtSec: number }> {
    return this._ticks$.asObservable();
  }

  start(options?: { fps?: number }): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const fps = Math.max(0, Math.floor(options?.fps ?? 0));

    // Run outside Angular to avoid change detection on each frame.
    this.zone.runOutsideAngular(() => {
      if (fps > 0) {
        const periodMs = Math.max(1, Math.floor(1000 / fps));
        this.sub = interval(periodMs).subscribe(() => this.emit());
      } else {
        this.sub = animationFrames()
          .pipe(map(({ elapsed }) => elapsed))
          .subscribe((t) => this.emit(t));
      }
    });
  }

  stop(): void {
    if (!this.running) return;
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.running = false;
  }

  private emit(time?: number): void {
    this.frame++;
    const now = time ?? performance.now();
    let dtSec = Math.max(0, (now - this.lastTime) / 1000);
    if(dtSec>0.050) dtSec = 0.016; //for debugging purposes enable stepping through
    this.lastTime = now;

    this.tickObject.time = now;
    this.tickObject.frame = this.frame;
    this.tickObject.dtSec = dtSec;
    this._ticks$.next(this.tickObject);
  }
}
