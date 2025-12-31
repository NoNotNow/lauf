import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { toNumber } from '../../utils/number-utils';
import { ITransformer } from './transformer.interface';

export interface TouchControllerOptions {
  linearAccel?: number;      // cells / s^2 when moving forward (at max distance)
  linearBrake?: number;      // cells / s^2 when moving backward (at max distance)
  linearDamping?: number;    // cells / s^2 to naturally slow when no input
  maxSpeed?: number;         // cells / s cap for |velocity|
  angularAccel?: number;     // deg / s^2 when rotating left/right (at max distance)
  angularDamping?: number;   // deg / s^2 to bleed spin when no input
  maxOmega?: number;         // deg / s cap for |omega|
  maxDistance?: number;      // pixels distance for full strength (default: 100)
  minMovementThreshold?: number; // pixels of movement required before controller activates (default: 15)
}

// TouchController: adjusts a StageItem's linear and angular velocities
// based on touch gestures. When a touch point moves, it applies:
// - Down: accelerate forward (strength based on vertical distance)
// - Up: accelerate backward/decelerate (strength based on vertical distance)
// - Left/Right: apply angular acceleration (strength based on horizontal distance)
// - Diagonal swipes activate both linear and angular simultaneously
// Strength scales with distance from touch start point.
export class TouchController implements ITransformer {
  private sub?: Subscription;
  private _item?: StageItem;
  private _phys?: StageItemPhysics;
  private touchStart: { x: number; y: number } | null = null;
  private currentTouch: { x: number; y: number } | null = null;
  private isActive: boolean = false; // Track if touch has moved enough to activate
  private opts: Required<TouchControllerOptions>;

  constructor(private ticker: TickService, item?: StageItem, params?: any) {
    this._item = item;
    if (item) {
      this._phys = StageItemPhysics.for(item);
    }
    this.opts = {
      linearAccel: params?.linearAccel ?? 2.5,
      linearBrake: params?.linearBrake ?? 2.0,
      linearDamping: params?.linearDamping ?? 0.2,
      maxSpeed: params?.maxSpeed ?? 8.0,
      angularAccel: params?.angularAccel ?? 600,
      angularDamping: params?.angularDamping ?? 600,
      maxOmega: params?.maxOmega ?? 240,
      maxDistance: params?.maxDistance ?? 100,
      minMovementThreshold: params?.minMovementThreshold ?? 15
    };
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    this._phys = item ? StageItemPhysics.for(item) : undefined;
  }

  start(): void {
    if (this.sub) return;
    // Subscribe to ticks to update velocities using dtSec
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
    // Listen to touch events
    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    this.touchStart = null;
    this.currentTouch = null;
    this.isActive = false;
  }

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.touchStart = { x: touch.clientX, y: touch.clientY };
      this.currentTouch = { x: touch.clientX, y: touch.clientY };
      this.isActive = false;
      // Don't prevent default on touchstart - let taps pass through for zoom
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.touchStart || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    this.currentTouch = { x: touch.clientX, y: touch.clientY };
    
    // Check if movement exceeds threshold
    const dx = this.currentTouch.x - this.touchStart.x;
    const dy = this.currentTouch.y - this.touchStart.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance >= this.opts.minMovementThreshold) {
      // Movement is significant enough - activate controller and prevent default
      if (!this.isActive) {
        this.isActive = true;
      }
      e.preventDefault();
    }
    // If movement is below threshold, don't prevent default - let it pass through for zoom
  };

  private onTouchEnd = (e: TouchEvent) => {
    // Only prevent default if controller was active (swipe), not if it was just a tap
    if (this.isActive) {
      e.preventDefault();
    }
    this.touchStart = null;
    this.currentTouch = null;
    this.isActive = false;
  };

  private onTick(dt: number): void {
    if (!this._item || !this._phys || dt === 0) return;

    // Read and normalize current values
    const velocity = this._phys.getVelocity();
    let vx = toNumber(velocity.vx, 0);
    let vy = toNumber(velocity.vy, 0);
    let omega = toNumber(this._phys.getAngularVelocity(), 0); // deg/s

    // Calculate touch vector and strength factors
    let forwardStrength = 0;
    let backwardStrength = 0;
    let leftStrength = 0;
    let rightStrength = 0;

    // Only process if touch is active (moved beyond threshold)
    if (this.isActive && this.touchStart && this.currentTouch) {
      const dx = this.currentTouch.x - this.touchStart.x;
      const dy = this.currentTouch.y - this.touchStart.y;

      // Calculate distance components
      const verticalDistance = Math.abs(dy);
      const horizontalDistance = Math.abs(dx);

      // Normalize strength based on distance (clamped to maxDistance for full strength)
      const verticalStrengthFactor = Math.min(verticalDistance / this.opts.maxDistance, 1.0);
      const horizontalStrengthFactor = Math.min(horizontalDistance / this.opts.maxDistance, 1.0);

      // Determine directions and apply strength
      if (dy > 0) {
        // Moving down (positive Y in screen coordinates) = forward
        forwardStrength = verticalStrengthFactor;
      } else if (dy < 0) {
        // Moving up (negative Y in screen coordinates) = backward
        backwardStrength = verticalStrengthFactor;
      }

      if (dx < 0) {
        // Moving left (negative X in screen coordinates) = left rotation
        leftStrength = horizontalStrengthFactor;
      } else if (dx > 0) {
        // Moving right (positive X in screen coordinates) = right rotation
        rightStrength = horizontalStrengthFactor;
      }
    }

    const forwardHeld = forwardStrength > 0;
    const backHeld = backwardStrength > 0;
    const leftHeld = leftStrength > 0;
    const rightHeld = rightStrength > 0;

    // Facing direction from item rotation (degrees). 0 deg faces up (negative Y).
    const pose: any = (this._item as any).Pose ?? ((this._item as any).Pose = {});
    const rotDeg = toNumber(pose.Rotation, 0);
    const rotRad = rotDeg * Math.PI / 180;
    // Forward vector: at 0°, forward is (0, -1); rotates with pose.
    const fx = Math.sin(rotRad);
    const fy = -Math.cos(rotRad);

    // Linear acceleration along forward vector (scaled by strength)
    let ax = 0, ay = 0;
    if (forwardHeld) {
      ax += this.opts.linearAccel * forwardStrength * fx;
      ay += this.opts.linearAccel * forwardStrength * fy;
    }
    if (backHeld) {
      ax -= this.opts.linearBrake * backwardStrength * fx;
      ay -= this.opts.linearBrake * backwardStrength * fy;
    }

    // Angular acceleration (scaled by strength)
    let alpha = 0; // deg/s^2
    if (leftHeld) alpha -= this.opts.angularAccel * leftStrength;
    if (rightHeld) alpha += this.opts.angularAccel * rightStrength;

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
    this._phys.accelerate(ax, ay, dt);
    this._phys.accelerateAngular(alpha, dt);
  }
}

