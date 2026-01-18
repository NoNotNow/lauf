import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { CollisionHandler } from '../collision-handler';
import { AxisAlignedBoundingBox } from '../collision';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { toNumber } from '../../utils/number-utils';
import { ITransformer } from './transformer.interface';
import { getWalkingInputState } from './walking-input';

export interface WalkingTransformerOptions {
  moveAccel?: number;       // cells / s^2 for horizontal movement
  maxSpeed?: number;        // cells / s horizontal speed cap
  jumpImpulse?: number;     // cells / s vertical impulse (negative is up)
  airControl?: number;      // 0..1 multiplier for horizontal accel when airborne
  uprightForce?: number;    // deg / s^2 toward upright rotation
  groundedEpsilon?: number; // threshold for ground detection
}

export class WalkingTransformer implements ITransformer {
  private sub?: Subscription;
  private collisionSub?: Subscription;
  private _item?: StageItem;
  private _phys?: StageItemPhysics;
  private opts: Required<WalkingTransformerOptions>;
  private groundedFromCollision = false;

  constructor(
    private ticker: TickService,
    private collisions?: CollisionHandler,
    private boundary?: AxisAlignedBoundingBox,
    item?: StageItem,
    params?: any
  ) {
    this._item = item;
    if (item) {
      this._phys = StageItemPhysics.for(item);
    }
    this.opts = {
      moveAccel: params?.moveAccel ?? 15,
      maxSpeed: params?.maxSpeed ?? 6,
      jumpImpulse: params?.jumpImpulse ?? 6,
      airControl: params?.airControl ?? 0.5,
      uprightForce: params?.uprightForce ?? 6,
      groundedEpsilon: params?.groundedEpsilon ?? 0.05
    };
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    this._phys = item ? StageItemPhysics.for(item) : undefined;
  }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
    if (this.collisions) {
      this.collisionSub = this.collisions.events$.subscribe(event => this.onCollision(event));
    }
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.collisionSub?.unsubscribe();
    this.collisionSub = undefined;
  }

  private onCollision(event: { a: StageItem; b: StageItem; normal: { x: number; y: number } }): void {
    if (!this._item) return;
    const epsilon = this.opts.groundedEpsilon;
    if (event.a === this._item) {
      if (event.normal.y > epsilon) {
        this.groundedFromCollision = true;
      }
    } else if (event.b === this._item) {
      if (event.normal.y < -epsilon) {
        this.groundedFromCollision = true;
      }
    }
  }

  private onTick(dt: number): void {
    if (!this._item || !this._phys || dt === 0) return;

    const groundedFromCollision = this.groundedFromCollision;
    this.groundedFromCollision = false;

    const groundedFromBoundary = this.isGroundedOnBoundary();
    const grounded = groundedFromCollision || groundedFromBoundary;

    const input = getWalkingInputState(this._item);
    const velocity = this._phys.getVelocity();
    let vx = toNumber(velocity.vx, 0);
    let vy = toNumber(velocity.vy, 0);

    const accelMultiplier = grounded ? 1 : this.opts.airControl;
    const accel = this.opts.moveAccel * accelMultiplier;

    if (input.moveAxis < 0) {
      vx -= accel * dt;
    } else if (input.moveAxis > 0) {
      vx += accel * dt;
    } else {
      const decel = this.opts.moveAccel * dt;
      if (Math.abs(vx) <= decel) {
        vx = 0;
      } else {
        vx -= Math.sign(vx) * decel;
      }
    }

    const maxSpeed = this.opts.maxSpeed;
    if (Math.abs(vx) > maxSpeed) {
      vx = Math.sign(vx) * maxSpeed;
    }

    if (input.jumpQueued && grounded) {
      vy = -this.opts.jumpImpulse;
      input.jumpQueued = false;
    } else if (!input.jumpHeld) {
      input.jumpQueued = false;
    }

    this._phys.setVelocity(vx, vy);
    this.applyUprightForce(dt);
  }

  private isGroundedOnBoundary(): boolean {
    if (!this.boundary || !this._item?.Pose?.Position || !this._item?.Pose?.Size) return false;
    const y = toNumber(this._item.Pose.Position.y, 0);
    const height = toNumber(this._item.Pose.Size.y, 0);
    const bottom = y + height;
    return bottom >= this.boundary.maxY - this.opts.groundedEpsilon;
  }

  private applyUprightForce(dt: number): void {
    if (!this._item || !this._phys) return;
    let rotation = toNumber(this._item.Pose?.Rotation, 0);
    while (rotation > 180) rotation -= 360;
    while (rotation < -180) rotation += 360;
    const omega = toNumber(this._phys.getAngularVelocity(), 0);
    const correction = -rotation * this.opts.uprightForce;
    const newOmega = omega + correction * dt;
    this._phys.setAngularVelocity(newOmega);
  }
}
