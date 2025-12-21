import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';

/**
 * Simulates physics-based gliding flight (like a bird or glider).
 * Works with gravity: dives to gain speed, then converts speed to height.
 * 
 * Physics model:
 * - Gravity pulls the bird down (handled by Gravity transformer)
 * - When diving (going down), speed increases naturally
 * - When climbing (going up), horizontal speed is converted to vertical lift
 * - Horizontal gliding motion with some randomness
 */
export class Glider {
  private sub?: Subscription;
  private _item?: StageItem;
  private _horizontalSpeed = 2.0; // base horizontal speed (cells/s)
  private _glideEfficiency = 0.3; // how efficiently speed converts to lift (0-1)
  private _minSpeedForLift = 1.0; // minimum speed needed to generate lift
  private _maxClimbRate = 3.0; // maximum climb rate (cells/s)
  private _directionPhase = 0;
  private _baseDirectionAngle = Math.random() * Math.PI * 2; // Random initial horizontal direction

  constructor(
    private ticker: TickService,
    item?: StageItem,
    horizontalSpeed?: number,
    glideEfficiency?: number,
    minSpeedForLift?: number,
    maxClimbRate?: number
  ) {
    if (item) this._item = item;
    if (typeof horizontalSpeed === 'number') this._horizontalSpeed = horizontalSpeed;
    if (typeof glideEfficiency === 'number') this._glideEfficiency = Math.max(0, Math.min(1, glideEfficiency));
    if (typeof minSpeedForLift === 'number') this._minSpeedForLift = minSpeedForLift;
    if (typeof maxClimbRate === 'number') this._maxClimbRate = maxClimbRate;
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
    if (!this._item || dtSec === 0) return;
    
    const phys = StageItemPhysics.get(this._item);
    const pose = this._item.Pose;
    
    // Get current velocities
    let vx = phys.vx;
    let vy = phys.vy;
    
    // Update horizontal direction with slow random variation
    const directionChangeFreq = 0.015; // How often direction changes (Hz)
    this._directionPhase += dtSec * directionChangeFreq * Math.PI * 2;
    const directionVariation = Math.sin(this._directionPhase) * 0.4; // ±0.4 radians variation
    const currentDirectionAngle = this._baseDirectionAngle + directionVariation;
    
    // Calculate desired horizontal velocity
    const desiredVx = this._horizontalSpeed * Math.cos(currentDirectionAngle);
    
    // Apply horizontal control (gradual adjustment toward desired direction)
    const horizontalControlStrength = 2.0; // How quickly it adjusts horizontal direction
    const vxDiff = desiredVx - vx;
    vx += vxDiff * horizontalControlStrength * dtSec;
    
    // Physics-based gliding: convert between horizontal speed and vertical lift
    const horizontalSpeed = Math.abs(vx);
    const isClimbing = vy < 0; // negative vy means going up
    const isDiving = vy > 0.5; // positive vy means going down (with some threshold)
    
    if (isClimbing && horizontalSpeed >= this._minSpeedForLift) {
      // When climbing: convert horizontal speed to vertical lift
      // This simulates a glider using forward momentum to gain altitude
      // The more horizontal speed, the more lift we can generate
      const availableLift = Math.min(horizontalSpeed * this._glideEfficiency, this._maxClimbRate);
      
      // Convert some horizontal speed to vertical lift
      // Reduce horizontal speed slightly as we convert it to lift
      const speedConversion = availableLift * 0.1; // Small conversion factor
      vx *= (1 - speedConversion * dtSec);
      
      // Apply lift upward (negative vy means up)
      // The lift counteracts gravity, allowing the bird to climb
      vy = Math.max(vy, -availableLift);
    } else if (isDiving) {
      // When diving: gravity accelerates us down (handled by Gravity transformer)
      // We can use this to build up horizontal speed
      // Maintain or slightly boost horizontal speed when diving
      if (horizontalSpeed < this._horizontalSpeed) {
        const speedBoost = 1.5; // Boost factor when diving
        vx += (this._horizontalSpeed - horizontalSpeed) * speedBoost * dtSec * 0.5;
      }
    } else {
      // Level flight or slow descent: maintain horizontal speed
      if (horizontalSpeed < this._horizontalSpeed * 0.7) {
        // If we're too slow, boost horizontal speed
        const speedRecovery = 1.0;
        vx += (this._horizontalSpeed - horizontalSpeed) * speedRecovery * dtSec;
      }
    }
    
    // Apply velocities
    StageItemPhysics.setVelocity(this._item, vx, vy);
    
    // Face the direction of flight
    if (Math.hypot(vx, vy) > 0.001) {
      const angleRad = Math.atan2(vy, vx);
      const angleDeg = (angleRad * 180) / Math.PI;
      pose.Rotation = angleDeg + 90; // Image points up, so add 90 degrees
    }
  }
}

