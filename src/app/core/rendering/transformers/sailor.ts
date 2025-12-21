import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';

/**
 * Simulates a sailing motion by controlling the velocity of a StageItem.
 */
export class Sailor {
  private sub?: Subscription;
  private _item?: StageItem;
  private _horizontalAmplitude = 2.0; // grid cells
  private _horizontalFrequency = 0.1; // Hz (patrol speed)
  private elapsed = 0;
  private phase = 0;

  constructor(
    private ticker: TickService,
    item?: StageItem,
    _amplitude?: number, // vertical amplitude (no longer used for direct position)
    _frequency?: number, // vertical frequency (no longer used for direct position)
    horizontalAmplitude?: number,
    horizontalFrequency?: number
  ) {
    if (item) this._item = item;
    if (typeof horizontalAmplitude === 'number') this._horizontalAmplitude = horizontalAmplitude;
    if (typeof horizontalFrequency === 'number') this._horizontalFrequency = horizontalFrequency;
    this.phase = Math.random() * Math.PI * 2;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
  }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(dtSec: number): void {
    if (!this._item) return;
    this.elapsed += dtSec;
    const t = this.elapsed;
    const pose = this._item.Pose;

    // We calculate velocity based on the derivative of the desired position functions
    // x(t) = x0 + A * sin(omega * t + phase)
    // vx(t) = dx/dt = A * omega * cos(omega * t + phase)
    
    const hOmega = 2 * Math.PI * this._horizontalFrequency;
    const vx = this._horizontalAmplitude * hOmega * Math.cos(hOmega * t + this.phase);

    // y(t) = y0 + verticalFlap(t) + verticalSailing(t)
    // dy/dt = v_flap * omega_flap * cos(omega_flap * t + phase) + v_sail * omega_sail * cos(omega_sail * t + phase)
    
    const vFlapFreq = 0.5;
    const vFlapAmp = 0.05;
    const vSailFreq = 0.05;
    const vSailAmp = 1.0;

    const vFlapOmega = 2 * Math.PI * vFlapFreq;
    const vSailOmega = 2 * Math.PI * vSailFreq;

    const vy = vFlapAmp * vFlapOmega * Math.cos(vFlapOmega * t + this.phase) +
               vSailAmp * vSailOmega * Math.cos(vSailOmega * t + this.phase * 0.7);

    // Apply velocity to the physics state
    StageItemPhysics.setVelocity(this._item, vx, vy);

    // Face the direction of flight.
    // The image points up (0 degrees), so we add 90 degrees to point its head in the movement direction.
    if (Math.hypot(vx, vy) > 0.001) {
        const angleRad = Math.atan2(vy, vx);
        const angleDeg = (angleRad * 180) / Math.PI;
        pose.Rotation = angleDeg + 90;
    }
  }
}
