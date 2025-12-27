import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { toNumber } from '../../utils/number-utils';

export interface StayUprightOptions {
  latency?: number;  // Time (seconds) before correction kicks in fully
  maxAngle?: number; // Maximum angle (degrees) to allow before applying correction
  speed?: number;    // Speed of correction (multiplier for angular velocity)
  force?: number;    // Angular force to apply
}

import { ITransformer } from './transformer.interface';

/**
 * StayUpright: ensures a StageItem stays upright (0 degrees rotation).
 * Applies angular velocity to correct any tilt.
 */
export class StayUpright implements ITransformer {
  private sub?: Subscription;
  private _item?: StageItem;
  private _phys?: StageItemPhysics;
  private _latency: number;
  private _maxAngle: number;
  private _speed: number;
  private _force: number;

  private _timeOffUpright = 0;

  constructor(private ticker: TickService, item?: StageItem, params?: any) {
    this._item = item;
    if (item) {
      this._phys = StageItemPhysics.for(item);
    }
    this._latency = params?.latency ?? params?.Latency ?? 0.5;
    this._maxAngle = params?.maxAngle ?? params?.MaxAngle ?? 5.0;
    this._speed = params?.speed ?? params?.Speed ?? 1.0;
    this._force = params?.force ?? params?.Force ?? 0.1;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    this._phys = item ? StageItemPhysics.for(item) : undefined;
  }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(dt: number): void {
    if (!this._item || !this._phys || dt === 0) return;

    // Get current rotation in degrees. We want it to be 0.
    let rotation = toNumber(this._item.Pose.Rotation, 0);

    // Normalize rotation to [-180, 180]
    while (rotation > 180) rotation -= 360;
    while (rotation < -180) rotation += 360;

    if (Math.abs(rotation) < 0.1) {
      // Already upright enough
      this._timeOffUpright = 0;
      return;
    }

    this._timeOffUpright += dt;

    if (this._timeOffUpright < this._latency) {
        // Still in latency period
        return;
    }

    let omega = toNumber(this._phys.getAngular(), 0);

    // Apply angular force to change omega towards 0 rotation
    // We want to apply a torque-like effect.
    // If rotation is positive (tilted right), we want negative omega (rotate left)
    const direction = rotation > 0 ? -1 : 1;
    
    // The force is applied to the angular velocity (omega)
    // omega += direction * force * dt
    // We also might want to consider the speed parameter as a multiplier
    
    const deltaOmega = direction * this._force * this._speed * 100 * dt;
    omega += deltaOmega;

    // Add some damping to prevent endless oscillation if we are close to upright
    // or if omega is too high in the wrong direction.
    if (Math.abs(rotation) < this._maxAngle) {
        // Within maxAngle, we can be more gentle or apply damping
        const damping = 0.95; 
        omega *= damping;
    }

    this._phys.setAngular(omega);
  }
}
