import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { AxisAlignedBoundingBox } from '../collision';
import { StageItemPhysics } from '../physics/stage-item-physics';

import { ITransformer } from './transformer.interface';

// Moves a single StageItem by applying force in a direction. Changes direction periodically.
// - force: acceleration to apply (cells/s^2)
// - directionChangeInterval: time in seconds between direction changes (default 15)
// - boundary: optional rectangle in cell coordinates; kept for API compatibility
// - bounce: whether to reflect velocity at the boundary; kept for API compatibility
export class Drifter implements ITransformer {
  private sub?: Subscription;
  private _item?: StageItem;
  private _phys?: StageItemPhysics;
  private _directionAngle = 0; // current direction in radians
  private _force = 0.01; // acceleration in cells/s^2
  private _directionChangeInterval = 15; // seconds
  private _elapsedTime = 0; // accumulated time since last direction change
  private _boundary?: AxisAlignedBoundingBox; // kept for API compatibility
  private _bounce = true; // kept for API compatibility

  constructor(
    private ticker: TickService,
    item?: StageItem,
    params?: any,
    boundary?: AxisAlignedBoundingBox
  ) {
    if (item) {
      this._item = item;
      this._phys = StageItemPhysics.for(item);
    }
    this._boundary = boundary;

    const force = params?.force ?? params?.Force;
    if (typeof force === 'number') {
      this._force = force;
    }

    const directionChangeInterval = params?.directionChangeInterval ?? params?.DirectionChangeInterval ?? params?.directionChangeSeconds ?? params?.DirectionChangeSeconds;
    if (typeof directionChangeInterval === 'number') {
      this._directionChangeInterval = Math.max(0.1, directionChangeInterval);
    }

    // Support legacy maxSpeed parameter for backward compatibility, but convert to force
    const maxSpeed = params?.maxSpeed ?? params?.MaxSpeed;
    if (typeof maxSpeed === 'number' && force === undefined) {
      // Rough conversion: assume we want to reach maxSpeed, estimate force needed
      // This is approximate and depends on damping, but provides backward compatibility
      this._force = maxSpeed * 0.1;
    }

    // Initialize with random direction
    this._directionAngle = Math.random() * Math.PI * 2;

    // Support explicit vx/vy for initial direction
    const vx = params?.vx ?? params?.Vx;
    const vy = params?.vy ?? params?.Vy;
    if (typeof vx === 'number' && typeof vy === 'number') {
      this._directionAngle = Math.atan2(vy, vx);
    }

    if (params?.bounce !== undefined) {
      this._bounce = !!params.bounce;
    }
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    this._phys = item ? StageItemPhysics.for(item) : undefined;
  }

  setForce(force: number): void {
    if (typeof force === 'number' && !isNaN(force)) {
      this._force = Math.max(0, force);
    }
  }

  setDirectionChangeInterval(interval: number): void {
    if (typeof interval === 'number' && !isNaN(interval)) {
      this._directionChangeInterval = Math.max(0.1, interval);
    }
  }

  setBoundary(boundary: AxisAlignedBoundingBox | undefined): void {
    this._boundary = boundary;
  }

  setBounce(bounce: boolean): void {
    this._bounce = !!bounce;
  }

  start(): void {
    if (this.sub) return;
    this._elapsedTime = 0;
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(dtSec: number): void {
    if (!this._phys || dtSec === 0) return;

    // Update elapsed time and change direction if needed
    this._elapsedTime += dtSec;
    if (this._elapsedTime >= this._directionChangeInterval) {
      this._directionAngle = Math.random() * Math.PI * 2;
      this._elapsedTime = 0;
    }

    // Apply force in current direction
    const ax = Math.cos(this._directionAngle) * this._force;
    const ay = Math.sin(this._directionAngle) * this._force;

    // Support direction constraint (e.g., "horizontal" or "vertical")
    // This would need to come from params if needed, but for now we'll skip it
    // since it's not in the current implementation

    this._phys.accelerate(ax, ay, dtSec);
  }
}
