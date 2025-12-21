import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { AxisAlignedBoundingBox, orientedBoundingBoxFromPose, orientedBoundingBoxIntersectsOrientedBoundingBox } from '../collision';
import { CollisionHandler } from '../collision-handler';

/**
 * Simulates physics-based gliding flight (like a bird or glider).
 * Works with gravity: dives to gain speed, then converts speed to height.
 * 
 * Physics model:
 * - Gravity pulls the bird down (handled by Gravity transformer)
 * - When diving (going down), speed increases naturally
 * - When climbing (going up), horizontal speed is converted to vertical lift
 * - Horizontal gliding motion with some randomness
 * - Boundary avoidance: turns around when too close to bottom
 * - Predictive collision avoidance: checks ahead for obstacles
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
  
  // Evasion state: remember last evasion decision to prevent twitching
  private _evasionState: {
    active: boolean;
    desiredHeading: number;
    urgency: number;
    timeRemaining: number; // seconds remaining for this evasion decision
  } | null = null;
  private readonly _evasionDuration = 1.0; // seconds to maintain evasion decision
  
  // Boundary avoidance
  private _boundary?: AxisAlignedBoundingBox;
  private _minDistanceToBoundary = 1.0; // minimum distance to any boundary before turning (cells)
  private _boundaryAvoidanceStrength = 3.0; // how strongly to avoid boundary
  
  // Predictive collision avoidance
  private _collisionHandler?: CollisionHandler;
  private _lookAheadDistance = 2.0; // how far ahead to check for collisions (cells)
  private _lookAheadTime = 0.5; // time horizon for collision prediction (seconds)
  private _collisionAvoidanceStrength = 4.0; // how strongly to avoid collisions

  constructor(
    private ticker: TickService,
    item?: StageItem,
    horizontalSpeed?: number,
    glideEfficiency?: number,
    minSpeedForLift?: number,
    maxClimbRate?: number,
    boundary?: AxisAlignedBoundingBox,
    collisionHandler?: CollisionHandler,
    minDistanceToBoundary?: number,
    boundaryAvoidanceStrength?: number,
    lookAheadDistance?: number,
    lookAheadTime?: number,
    collisionAvoidanceStrength?: number
  ) {
    if (item) this._item = item;
    if (typeof horizontalSpeed === 'number') this._horizontalSpeed = horizontalSpeed;
    if (typeof glideEfficiency === 'number') this._glideEfficiency = Math.max(0, Math.min(1, glideEfficiency));
    if (typeof minSpeedForLift === 'number') this._minSpeedForLift = minSpeedForLift;
    if (typeof maxClimbRate === 'number') this._maxClimbRate = maxClimbRate;
    this._boundary = boundary;
    this._collisionHandler = collisionHandler;
    if (typeof minDistanceToBoundary === 'number') this._minDistanceToBoundary = minDistanceToBoundary;
    if (typeof boundaryAvoidanceStrength === 'number') this._boundaryAvoidanceStrength = boundaryAvoidanceStrength;
    if (typeof lookAheadDistance === 'number') this._lookAheadDistance = lookAheadDistance;
    if (typeof lookAheadTime === 'number') this._lookAheadTime = lookAheadTime;
    if (typeof collisionAvoidanceStrength === 'number') this._collisionAvoidanceStrength = collisionAvoidanceStrength;
  }
  
  setBoundary(boundary?: AxisAlignedBoundingBox): void {
    this._boundary = boundary;
  }
  
  setCollisionHandler(handler?: CollisionHandler): void {
    this._collisionHandler = handler;
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
    
    // Get current velocities (momentum)
    let vx = phys.vx;
    let vy = phys.vy;
    const currentSpeed = Math.hypot(vx, vy);
    const currentDirection = Math.atan2(vy, vx);
    
    // Update or clear evasion state
    if (this._evasionState) {
      this._evasionState.timeRemaining -= dtSec;
      if (this._evasionState.timeRemaining <= 0) {
        this._evasionState = null; // Evasion decision expired
      }
    }
    
    // Determine desired heading direction and urgency (how close to danger)
    let desiredHeading = currentDirection;
    let urgency = 0; // 0 = no urgency, 1 = maximum urgency (very close to wall/obstacle)
    let newEvasionNeeded = false;
    
    // Check boundaries and adjust desired heading if needed (simple boat-like steering)
    if (this._boundary) {
      const pos = pose.Position;
      const size = pose.Size;
      const halfW = (size?.x ?? 0) * 0.5;
      const halfH = (size?.y ?? 0) * 0.5;
      const centerX = pos.x + halfW;
      const centerY = pos.y + halfH;
      
      // Calculate distances to boundaries
      const distToLeft = centerX - this._boundary.minX;
      const distToRight = this._boundary.maxX - centerX;
      const distToTop = centerY - this._boundary.minY;
      const distToBottom = this._boundary.maxY - centerY;
      
      // Find the closest boundary
      const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
      
      // Calculate urgency based on distance (closer = higher urgency)
      const avoidanceThreshold = this._minDistanceToBoundary * 1.5;
      if (minDist < avoidanceThreshold) {
        // Urgency increases as distance decreases
        // At minDistanceToBoundary, urgency = 1.0 (maximum)
        // At avoidanceThreshold, urgency = 0.0 (minimum)
        urgency = Math.max(0, Math.min(1, 1 - (minDist - this._minDistanceToBoundary) / (avoidanceThreshold - this._minDistanceToBoundary)));
      }
      
      // Decisive steering: prioritize the most urgent direction
      // Check walls more proactively - not just when heading toward them
      const avoidanceThreshold2 = this._minDistanceToBoundary * 1.5;
      let steerX = 0;
      let steerY = 0;
      let maxUrgency = 0;
      
      // Check each wall - be more proactive about avoiding walls
      // Left wall: check if too close (heading toward it OR just close)
      if (distToLeft < avoidanceThreshold2) {
        const wallUrgency = 1 - (distToLeft - this._minDistanceToBoundary) / (avoidanceThreshold2 - this._minDistanceToBoundary);
        // Increase urgency if heading toward the wall
        const headingUrgency = vx < -0.1 ? 1.2 : 1.0;
        const totalUrgency = wallUrgency * headingUrgency;
        if (totalUrgency > maxUrgency) {
          maxUrgency = totalUrgency;
          steerX = 1; // Steer right
          steerY = 0; // Clear Y to avoid conflict
        }
      }
      
      // Right wall: check if too close
      if (distToRight < avoidanceThreshold2) {
        const wallUrgency = 1 - (distToRight - this._minDistanceToBoundary) / (avoidanceThreshold2 - this._minDistanceToBoundary);
        const headingUrgency = vx > 0.1 ? 1.2 : 1.0;
        const totalUrgency = wallUrgency * headingUrgency;
        if (totalUrgency > maxUrgency) {
          maxUrgency = totalUrgency;
          steerX = -1; // Steer left
          steerY = 0; // Clear Y to avoid conflict
        }
      }
      
      // Top wall: check if too close
      if (distToTop < avoidanceThreshold2) {
        const wallUrgency = 1 - (distToTop - this._minDistanceToBoundary) / (avoidanceThreshold2 - this._minDistanceToBoundary);
        const headingUrgency = vy < -0.1 ? 1.2 : 1.0;
        const totalUrgency = wallUrgency * headingUrgency;
        if (totalUrgency > maxUrgency) {
          maxUrgency = totalUrgency;
          steerX = 0; // Clear X to avoid conflict
          steerY = 1; // Steer down
        }
      }
      
      // Bottom wall: check if too close
      if (distToBottom < avoidanceThreshold2) {
        const wallUrgency = 1 - (distToBottom - this._minDistanceToBoundary) / (avoidanceThreshold2 - this._minDistanceToBoundary);
        const headingUrgency = vy > 0.1 ? 1.2 : 1.0;
        const totalUrgency = wallUrgency * headingUrgency;
        if (totalUrgency > maxUrgency) {
          maxUrgency = totalUrgency;
          steerX = 0; // Clear X to avoid conflict
          steerY = -1; // Steer up
        }
      }
      
      // If we're in a corner (close to two walls), choose the direction with most clearance
      if (steerX !== 0 && steerY !== 0) {
        // We have conflicting directions - choose the one with more clearance
        const clearanceX = steerX > 0 ? distToRight : distToLeft;
        const clearanceY = steerY > 0 ? distToBottom : distToTop;
        
        if (clearanceX > clearanceY) {
          // More clearance in X direction, prioritize X
          steerY = 0;
        } else {
          // More clearance in Y direction, prioritize Y
          steerX = 0;
        }
      }
      
      // If steering needed, calculate desired heading
      if (steerX !== 0 || steerY !== 0) {
        // Use the steering direction directly (already normalized to -1, 0, or 1)
        desiredHeading = Math.atan2(steerY, steerX);
        // Update urgency to match the selected wall's urgency
        urgency = Math.max(urgency, maxUrgency);
        newEvasionNeeded = true;
      } else {
        // Normal behavior: random variation in heading
        const directionChangeFreq = 0.015;
        this._directionPhase += dtSec * directionChangeFreq * Math.PI * 2;
        const directionVariation = Math.sin(this._directionPhase) * 0.4;
        desiredHeading = this._baseDirectionAngle + directionVariation;
      }
    } else {
      // No boundary - just random variation
      const directionChangeFreq = 0.015;
      this._directionPhase += dtSec * directionChangeFreq * Math.PI * 2;
      const directionVariation = Math.sin(this._directionPhase) * 0.4;
      desiredHeading = this._baseDirectionAngle + directionVariation;
    }
    
    // Check for obstacles ahead and increase urgency if collision predicted
    if (this._collisionHandler && this._item) {
      const collisionCheck = this.checkCollisionAhead(dtSec);
      if (collisionCheck.avoid) {
        // Obstacle detected - increase urgency
        urgency = Math.max(urgency, 0.7); // At least 70% urgency for obstacles
        // Update desired heading to avoid obstacle
        desiredHeading = Math.atan2(collisionCheck.steerY, collisionCheck.steerX);
        newEvasionNeeded = true;
      }
    }
    
    // Use evasion state if active and still valid, otherwise create new one if needed
    if (this._evasionState && this._evasionState.timeRemaining > 0) {
      // Stick with previous evasion decision to prevent twitching
      desiredHeading = this._evasionState.desiredHeading;
      urgency = this._evasionState.urgency;
    } else if (newEvasionNeeded && urgency > 0.3) {
      // Create new evasion state only if urgency is significant
      this._evasionState = {
        active: true,
        desiredHeading: desiredHeading,
        urgency: urgency,
        timeRemaining: this._evasionDuration
      };
    } else if (!newEvasionNeeded) {
      // Clear evasion state if no longer needed
      this._evasionState = null;
    }
    
    // Boat-like turning: gradually rotate momentum toward desired heading
    // Turn rate increases with urgency (closer = steeper turn)
    let angleDiff = desiredHeading - currentDirection;
    
    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Base turn rate (when no urgency)
    const baseTurnRate = 1.5; // radians per second
    // Maximum turn rate (when maximum urgency)
    const maxTurnRate = 6.0; // radians per second (much steeper when close)
    
    // Interpolate turn rate based on urgency
    const turnRate = baseTurnRate + (maxTurnRate - baseTurnRate) * urgency;
    
    const turnAmount = Math.max(-turnRate * dtSec, Math.min(turnRate * dtSec, angleDiff));
    const newDirection = currentDirection + turnAmount;
    
    // Rotate velocity vector (momentum) toward new direction - boat-like behavior
    // Maintain speed, just rotate the direction (momentum carries through the turn)
    const targetSpeed = Math.max(currentSpeed, this._horizontalSpeed * 0.7);
    vx = Math.cos(newDirection) * targetSpeed;
    vy = Math.sin(newDirection) * targetSpeed;
    
    // Physics-based gliding: convert between horizontal speed and vertical lift
    // This happens naturally as the momentum rotates - no need to force it
    const horizontalSpeed = Math.abs(vx);
    const isClimbing = vy < 0; // negative vy means going up
    const isDiving = vy > 0.5; // positive vy means going down
    
    if (isClimbing && horizontalSpeed >= this._minSpeedForLift) {
      // When climbing: convert horizontal speed to vertical lift
      const availableLift = Math.min(horizontalSpeed * this._glideEfficiency, this._maxClimbRate);
      // Apply lift upward (negative vy means up)
      vy = Math.max(vy, -availableLift);
    }
    
    // Maintain minimum forward speed (boat-like momentum)
    if (currentSpeed < this._horizontalSpeed * 0.5) {
      // If too slow, boost speed in current direction
      const speedBoost = 1.0;
      const boostX = Math.cos(newDirection) * speedBoost * dtSec;
      const boostY = Math.sin(newDirection) * speedBoost * dtSec;
      vx += boostX;
      vy += boostY;
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
  
  /**
   * Checks for collisions ahead by predicting future position
   * Returns steering direction to avoid collision
   */
  private checkCollisionAhead(dtSec: number): { avoid: boolean; steerX: number; steerY: number } {
    if (!this._item || !this._collisionHandler) {
      return { avoid: false, steerX: 0, steerY: 0 };
    }
    
    const phys = StageItemPhysics.get(this._item);
    const pose = this._item.Pose;
    const pos = pose.Position;
    const size = pose.Size;
    
    // Calculate current velocity
    const vx = phys.vx ?? 0;
    const vy = phys.vy ?? 0;
    const speed = Math.hypot(vx, vy);
    
    if (speed < 0.1) {
      return { avoid: false, steerX: 0, steerY: 0 };
    }
    
    // Predict position ahead (using lookAheadTime or lookAheadDistance, whichever is more restrictive)
    const timeHorizon = Math.min(this._lookAheadTime, this._lookAheadDistance / Math.max(speed, 0.1));
    const futureX = pos.x + vx * timeHorizon;
    const futureY = pos.y + vy * timeHorizon;
    
    // Create a test pose at the predicted position
    const testPose = {
      Position: { x: futureX, y: futureY },
      Size: size,
      Rotation: pose.Rotation
    } as any; // Type assertion needed for collision check
    
    // Get our OBB at predicted position
    const ourOBB = orientedBoundingBoxFromPose(testPose, this._item.Physics.collisionBox);
    
    // Check against all other items in collision handler
    // We need to access the items list - let's use a simpler approach: check against boundary first
    // For obstacle avoidance, we'll check if we're heading toward boundaries or use a simpler heuristic
    
    // Check if predicted position would hit boundaries (predictive check)
    if (this._boundary) {
      const halfW = (size?.x ?? 0) * 0.5;
      const halfH = (size?.y ?? 0) * 0.5;
      const futureCenterX = futureX + halfW;
      const futureCenterY = futureY + halfH;
      
      // Calculate distances to boundaries at predicted position
      const futureDistToLeft = futureCenterX - this._boundary.minX;
      const futureDistToRight = this._boundary.maxX - futureCenterX;
      const futureDistToTop = futureCenterY - this._boundary.minY;
      const futureDistToBottom = this._boundary.maxY - futureCenterY;
      
      // Check if we would hit any boundary
      const wouldHitLeft = futureDistToLeft < halfW;
      const wouldHitRight = futureDistToRight < halfW;
      const wouldHitTop = futureDistToTop < halfH;
      const wouldHitBottom = futureDistToBottom < halfH;
      
      // Also check if we're getting too close (before actually hitting)
      const tooCloseToLeft = futureDistToLeft < this._minDistanceToBoundary;
      const tooCloseToRight = futureDistToRight < this._minDistanceToBoundary;
      const tooCloseToTop = futureDistToTop < this._minDistanceToBoundary;
      const tooCloseToBottom = futureDistToBottom < this._minDistanceToBoundary;
      
      if (wouldHitLeft || wouldHitRight || wouldHitTop || wouldHitBottom || 
          tooCloseToLeft || tooCloseToRight || tooCloseToTop || tooCloseToBottom) {
        // Steer away from the boundary we're heading toward
        let steerX = 0;
        let steerY = 0;
        
        if (wouldHitLeft || tooCloseToLeft) steerX = 1; // Steer right
        if (wouldHitRight || tooCloseToRight) steerX = -1; // Steer left
        if (wouldHitTop || tooCloseToTop) steerY = 1; // Steer down
        if (wouldHitBottom || tooCloseToBottom) steerY = -1; // Steer up
        
        // Normalize steering direction
        const steerLen = Math.hypot(steerX, steerY);
        if (steerLen > 0) {
          return { avoid: true, steerX: steerX / steerLen, steerY: steerY / steerLen };
        }
      }
    }
    
    // Check for collisions with obstacles (boundaries are already checked above)
    if (this._collisionHandler && this._collisionHandler.wouldCollideAt(testPose, this._item)) {
      // Collision predicted with an obstacle - steer away from current direction
      // Steer perpendicular to current velocity
      const speed = Math.hypot(vx, vy);
      if (speed > 0.1) {
        // Steer 90 degrees to the right of current direction
        const steerX = -vy / speed; // Perpendicular to velocity
        const steerY = vx / speed;
        return { avoid: true, steerX, steerY };
      }
    }
    
    // Also check boundaries using collision handler method if available
    if (this._boundary && this._collisionHandler && 
        this._collisionHandler.wouldCollideWithBoundary && 
        this._collisionHandler.wouldCollideWithBoundary(testPose, this._boundary)) {
      // This is a fallback - boundary checking above should catch this, but just in case
      const halfW = (size?.x ?? 0) * 0.5;
      const halfH = (size?.y ?? 0) * 0.5;
      const futureCenterX = futureX + halfW;
      const futureCenterY = futureY + halfH;
      
      const futureDistToLeft = futureCenterX - this._boundary.minX;
      const futureDistToRight = this._boundary.maxX - futureCenterX;
      const futureDistToTop = futureCenterY - this._boundary.minY;
      const futureDistToBottom = this._boundary.maxY - futureCenterY;
      
      let steerX = 0;
      let steerY = 0;
      if (futureDistToLeft < halfW) steerX = 1;
      if (futureDistToRight < halfW) steerX = -1;
      if (futureDistToTop < halfH) steerY = 1;
      if (futureDistToBottom < halfH) steerY = -1;
      
      const steerLen = Math.hypot(steerX, steerY);
      if (steerLen > 0) {
        return { avoid: true, steerX: steerX / steerLen, steerY: steerY / steerLen };
      }
    }
    
    return { avoid: false, steerX: 0, steerY: 0 };
  }
}

