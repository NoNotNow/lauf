import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { toNumber } from '../../utils/number-utils';

export interface KeyboardControllerOptions {
  linearAccel?: number;      // cells / s^2 when UP is held (forward)
  linearBrake?: number;      // cells / s^2 when DOWN is held (against forward)
  linearDamping?: number;    // cells / s^2 to naturally slow when no input
  maxSpeed?: number;         // cells / s cap for |velocity|
  angularAccel?: number;     // deg / s^2 when LEFT/RIGHT are held
  angularDamping?: number;   // deg / s^2 to bleed spin when no input
  maxOmega?: number;         // deg / s cap for |omega|
}

// KeyboardController: adjusts a StageItem's linear and angular velocities
// based on arrow keys. Forward is along the item's facing direction (Pose.Rotation).
// - Up: accelerate forward
// - Down: accelerate backward (decelerate forward)
// - Left/Right: apply angular acceleration (-/+)
// Uses reasonable defaults so it works out-of-the-box.
export class KeyboardController {
  private sub?: Subscription;
  private lastTime?: number;
  private _item?: StageItem;
  private keys = new Set<string>();
  private opts: Required<KeyboardControllerOptions>;

  constructor(private ticker: TickService, item?: StageItem, options?: KeyboardControllerOptions) {
    this._item = item;
    this.opts = {
      linearAccel: options?.linearAccel ?? 2.0,
      linearBrake: options?.linearBrake ?? 2.5,
      linearDamping: options?.linearDamping ?? 1.2,
      maxSpeed: options?.maxSpeed ?? 4.0,
      angularAccel: options?.angularAccel ?? 180,      // deg/s^2
      angularDamping: options?.angularDamping ?? 120,  // deg/s^2
      maxOmega: options?.maxOmega ?? 240               // deg/s
    };
  }

  setItem(item: StageItem | undefined): void { this._item = item; }

  start(): void {
    if (this.sub) return;
    // Subscribe to ticks to update velocities using dt
    this.sub = this.ticker.ticks$.subscribe(({ time }) => this.onTick(time));
    // Listen to keyboard
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.lastTime = undefined;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = normalizeKey(e);
    e.preventDefault();
    if (k) this.keys.add(k);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = normalizeKey(e);
    if (k) this.keys.delete(k);
  };

  private onTick(time: number): void {
    const item = this._item;
    if (!item) return;
    const prev = this.lastTime ?? time;
    this.lastTime = time;
    const dt = Math.max(0, (time - prev) / 1000);
    if (dt === 0) return;

    const phys = StageItemPhysics.get(item);
    // Read and normalize current values
    let vx = toNumber(phys.vx, 0);
    let vy = toNumber(phys.vy, 0);
    let omega = toNumber(phys.omega, 0); // deg/s

    // Controls
    const forwardHeld = this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const backHeld = this.keys.has('ArrowDown') || this.keys.has('KeyS');
    const leftHeld = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const rightHeld = this.keys.has('ArrowRight') || this.keys.has('KeyD');

    // Facing direction from item rotation (degrees). 0 deg faces up (negative Y).
    const pose: any = (item as any).Pose ?? ((item as any).Pose = {});
    const rotDeg = toNumber(pose.Rotation, 0);
    const rotRad = rotDeg * Math.PI / 180;
    // Forward vector: at 0°, forward is (0, -1); rotates with pose.
    const fx = Math.sin(rotRad);
    const fy = -Math.cos(rotRad);

    // Linear acceleration along forward vector
    let ax = 0, ay = 0;
    if (forwardHeld) {
      ax += this.opts.linearAccel * fx;
      ay += this.opts.linearAccel * fy;
    }
    if (backHeld) {
      ax -= this.opts.linearBrake * fx;
      ay -= this.opts.linearBrake * fy;
    }

    // Angular acceleration
    let alpha = 0; // deg/s^2
    if (leftHeld) alpha -= this.opts.angularAccel;
    if (rightHeld) alpha += this.opts.angularAccel;

    // Apply damping if no input on that channel
    if (!forwardHeld && !backHeld) {
      const speed = Math.hypot(vx, vy);
      if (speed > 0) {
        const dec = this.opts.linearDamping * dt;
        const newSpeed = Math.max(0, speed - dec);
        const s = newSpeed / speed;
        vx *= s; vy *= s;
      }
    } else {
      // integrate linear accel
      vx += ax * dt;
      vy += ay * dt;
    }

    if (!leftHeld && !rightHeld) {
      const sign = Math.sign(omega);
      const mag = Math.abs(omega);
      const dec = this.opts.angularDamping * dt;
      const newMag = Math.max(0, mag - dec);
      omega = sign * newMag;
    } else {
      omega += alpha * dt;
    }

    // Clamp to maximums
    const speed = Math.hypot(vx, vy);
    if (speed > this.opts.maxSpeed) {
      const s = this.opts.maxSpeed / (speed || 1);
      vx *= s; vy *= s;
    }
    const maxW = this.opts.maxOmega;
    if (Math.abs(omega) > maxW) {
      omega = Math.sign(omega) * maxW;
    }

    StageItemPhysics.setVelocity(item, vx, vy);
    StageItemPhysics.setAngular(item, omega);
  }
}

function normalizeKey(e: KeyboardEvent): string | null {
  // Prefer codes so WASD and arrows are distinct regardless of layout
  const code = e.code;
  switch (code) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'KeyW':
    case 'KeyA':
    case 'KeyS':
    case 'KeyD':
      return code;
    default:
      return null;
  }
}
