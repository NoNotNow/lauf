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
import { ITransformer } from './transformer.interface';

export class Glider implements ITransformer {
  private sub?: Subscription;
  private _item?: StageItem;
  private _phys?: StageItemPhysics;
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
    params?: any,
    boundary?: AxisAlignedBoundingBox,
    collisionHandler?: CollisionHandler
  ) {
    if (item) {
      this._item = item;
      this._phys = StageItemPhysics.for(item);
    }
    this._boundary = boundary;
    this._collisionHandler = collisionHandler;

    if (params) {
      this._horizontalSpeed = params.horizontalSpeed ?? params.horizontalAmplitude ?? this._horizontalSpeed;
      this._glideEfficiency = params.glideEfficiency ?? this._glideEfficiency;
      this._minSpeedForLift = params.minSpeedForLift ?? this._minSpeedForLift;
      this._maxClimbRate = params.maxClimbRate ?? this._maxClimbRate;
      this._minDistanceToBoundary = params.minDistanceToBoundary ?? params.minDistanceToBottom ?? this._minDistanceToBoundary;
      this._boundaryAvoidanceStrength = params.boundaryAvoidanceStrength ?? this._boundaryAvoidanceStrength;
      this._lookAheadDistance = params.lookAheadDistance ?? this._lookAheadDistance;
      this._lookAheadTime = params.lookAheadTime ?? this._lookAheadTime;
      this._collisionAvoidanceStrength = params.collisionAvoidanceStrength ?? this._collisionAvoidanceStrength;
    }
    
    this._glideEfficiency = Math.max(0, Math.min(1, this._glideEfficiency));
  }
  
  setBoundary(boundary?: AxisAlignedBoundingBox): void {
    this._boundary = boundary;
  }
  
  setCollisionHandler(handler?: CollisionHandler): void {
    this._collisionHandler = handler;
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

  private onTick(dtSec: number): void {
    if (!this._item || !this._phys || dtSec === 0) return;
    
    const pose = this._item.Pose;
    const velocity = this._phys.getVelocity();
    const currentVelocity = { vx: velocity.vx, vy: velocity.vy };
    const currentSpeed = Math.hypot(currentVelocity.vx, currentVelocity.vy);
    const currentDirection = Math.atan2(currentVelocity.vy, currentVelocity.vx);
    
    this.updateEvasionState(dtSec);
    
    const headingResult = this.determineDesiredHeading(currentVelocity, dtSec);
    const { desiredHeading, urgency } = this.applyEvasionState(headingResult);
    
    const newVelocity = this.rotateMomentumTowardHeading(
      currentDirection,
      desiredHeading,
      currentSpeed,
      urgency,
      dtSec
    );
    
    this.applyGlidingPhysics(newVelocity);
    this.maintainMinimumSpeed(newVelocity, currentSpeed, dtSec);
    
    this._phys.setVelocity(newVelocity.vx, newVelocity.vy);
    this.updateRotation(pose, newVelocity);
  }
  
  private updateEvasionState(dtSec: number): void {
    if (this._evasionState) {
      this._evasionState.timeRemaining -= dtSec;
      if (this._evasionState.timeRemaining <= 0) {
        this._evasionState = null;
      }
    }
  }
  
  private determineDesiredHeading(
    currentVelocity: { vx: number; vy: number },
    dtSec: number
  ): { desiredHeading: number; urgency: number; newEvasionNeeded: boolean } {
    let desiredHeading = Math.atan2(currentVelocity.vy, currentVelocity.vx);
    let urgency = 0;
    let newEvasionNeeded = false;
    
    if (this._boundary) {
      const boundaryResult = this.calculateBoundaryAvoidance(currentVelocity);
      if (boundaryResult.needsAvoidance) {
        desiredHeading = boundaryResult.desiredHeading;
        urgency = boundaryResult.urgency;
        newEvasionNeeded = true;
      } else {
        desiredHeading = this.calculateRandomHeading(dtSec);
      }
    } else {
      desiredHeading = this.calculateRandomHeading(dtSec);
    }
    
    const obstacleResult = this.checkObstacleCollision(dtSec);
    if (obstacleResult.needsAvoidance) {
      urgency = Math.max(urgency, 0.7);
      desiredHeading = obstacleResult.desiredHeading;
      newEvasionNeeded = true;
    }
    
    return { desiredHeading, urgency, newEvasionNeeded };
  }
  
  private calculateBoundaryAvoidance(
    currentVelocity: { vx: number; vy: number }
  ): { needsAvoidance: boolean; desiredHeading: number; urgency: number } {
    if (!this._boundary || !this._item) {
      return { needsAvoidance: false, desiredHeading: 0, urgency: 0 };
    }
    
    const pose = this._item.Pose;
    const pos = pose.Position;
    const size = pose.Size;
    const halfW = (size?.x ?? 0) * 0.5;
    const halfH = (size?.y ?? 0) * 0.5;
    const centerX = pos.x + halfW;
    const centerY = pos.y + halfH;
    
    const distances = this.calculateBoundaryDistances(centerX, centerY);
    const minDist = Math.min(distances.left, distances.right, distances.top, distances.bottom);
    
    let urgency = 0;
    if (minDist < this._minDistanceToBoundary) {
      urgency = Math.max(0, Math.min(1, 1 - (minDist / this._minDistanceToBoundary)));
    }
    
    const steering = this.calculateSteeringDirection(distances, currentVelocity);
    
    if (steering.steerX !== 0 || steering.steerY !== 0) {
      const desiredHeading = Math.atan2(steering.steerY, steering.steerX);
      urgency = Math.max(urgency, steering.maxUrgency);
      return { needsAvoidance: true, desiredHeading, urgency };
    }
    
    return { needsAvoidance: false, desiredHeading: 0, urgency };
  }
  
  private calculateBoundaryDistances(
    centerX: number,
    centerY: number
  ): { left: number; right: number; top: number; bottom: number } {
    if (!this._boundary) {
      return { left: Infinity, right: Infinity, top: Infinity, bottom: Infinity };
    }
    
    return {
      left: centerX - this._boundary.minX,
      right: this._boundary.maxX - centerX,
      top: centerY - this._boundary.minY,
      bottom: this._boundary.maxY - centerY
    };
  }
  
  private calculateSteeringDirection(
    distances: { left: number; right: number; top: number; bottom: number },
    currentVelocity: { vx: number; vy: number }
  ): { steerX: number; steerY: number; maxUrgency: number } {
    const avoidanceThreshold = this._minDistanceToBoundary;
    let steerX = 0;
    let steerY = 0;
    let maxUrgency = 0;
    
    if (distances.left < avoidanceThreshold) {
      const wallUrgency = 1 - (distances.left / this._minDistanceToBoundary);
      const headingUrgency = currentVelocity.vx < -0.1 ? 1.3 : 1.0;
      const totalUrgency = Math.min(1, wallUrgency * headingUrgency);
      if (totalUrgency > maxUrgency) {
        maxUrgency = totalUrgency;
        steerX = 1;
        steerY = 0;
      }
    }
    
    if (distances.right < avoidanceThreshold) {
      const wallUrgency = 1 - (distances.right / this._minDistanceToBoundary);
      const headingUrgency = currentVelocity.vx > 0.1 ? 1.3 : 1.0;
      const totalUrgency = Math.min(1, wallUrgency * headingUrgency);
      if (totalUrgency > maxUrgency) {
        maxUrgency = totalUrgency;
        steerX = -1;
        steerY = 0;
      }
    }
    
    if (distances.top < avoidanceThreshold) {
      const wallUrgency = 1 - (distances.top / this._minDistanceToBoundary);
      const headingUrgency = currentVelocity.vy < -0.1 ? 1.3 : 1.0;
      const totalUrgency = Math.min(1, wallUrgency * headingUrgency);
      if (totalUrgency > maxUrgency) {
        maxUrgency = totalUrgency;
        steerX = 0;
        steerY = 1;
      }
    }
    
    if (distances.bottom < avoidanceThreshold) {
      const wallUrgency = 1 - (distances.bottom / this._minDistanceToBoundary);
      const headingUrgency = currentVelocity.vy > 0.1 ? 1.3 : 1.0;
      const totalUrgency = Math.min(1, wallUrgency * headingUrgency);
      if (totalUrgency > maxUrgency) {
        maxUrgency = totalUrgency;
        steerX = 0;
        steerY = -1;
      }
    }
    
    // Resolve corner conflicts
    if (steerX !== 0 && steerY !== 0) {
      const clearanceX = steerX > 0 ? distances.right : distances.left;
      const clearanceY = steerY > 0 ? distances.bottom : distances.top;
      
      if (clearanceX > clearanceY) {
        steerY = 0;
      } else {
        steerX = 0;
      }
    }
    
    return { steerX, steerY, maxUrgency };
  }
  
  private calculateRandomHeading(dtSec: number): number {
    const directionChangeFreq = 0.015;
    this._directionPhase += dtSec * directionChangeFreq * Math.PI * 2;
    const directionVariation = Math.sin(this._directionPhase) * 0.4;
    return this._baseDirectionAngle + directionVariation;
  }
  
  private checkObstacleCollision(
    dtSec: number
  ): { needsAvoidance: boolean; desiredHeading: number } {
    if (!this._collisionHandler || !this._item) {
      return { needsAvoidance: false, desiredHeading: 0 };
    }
    
    const collisionCheck = this.checkCollisionAhead(dtSec);
    if (collisionCheck.avoid) {
      const desiredHeading = Math.atan2(collisionCheck.steerY, collisionCheck.steerX);
      return { needsAvoidance: true, desiredHeading };
    }
    
    return { needsAvoidance: false, desiredHeading: 0 };
  }
  
  private applyEvasionState(
    headingResult: { desiredHeading: number; urgency: number; newEvasionNeeded: boolean }
  ): { desiredHeading: number; urgency: number } {
    if (this._evasionState && this._evasionState.timeRemaining > 0) {
      return {
        desiredHeading: this._evasionState.desiredHeading,
        urgency: this._evasionState.urgency
      };
    }
    
    if (headingResult.newEvasionNeeded && headingResult.urgency > 0.3) {
      this._evasionState = {
        active: true,
        desiredHeading: headingResult.desiredHeading,
        urgency: headingResult.urgency,
        timeRemaining: this._evasionDuration
      };
    } else if (!headingResult.newEvasionNeeded) {
      this._evasionState = null;
    }
    
    return {
      desiredHeading: headingResult.desiredHeading,
      urgency: headingResult.urgency
    };
  }
  
  private rotateMomentumTowardHeading(
    currentDirection: number,
    desiredHeading: number,
    currentSpeed: number,
    urgency: number,
    dtSec: number
  ): { vx: number; vy: number } {
    let angleDiff = desiredHeading - currentDirection;
    
    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    const turnRate = this.calculateTurnRate(urgency);
    const turnAmount = Math.max(-turnRate * dtSec, Math.min(turnRate * dtSec, angleDiff));
    const newDirection = currentDirection + turnAmount;
    
    const targetSpeed = Math.max(currentSpeed, this._horizontalSpeed * 0.7);
    return {
      vx: Math.cos(newDirection) * targetSpeed,
      vy: Math.sin(newDirection) * targetSpeed
    };
  }
  
  private calculateTurnRate(urgency: number): number {
    const baseTurnRate = 1.5; // radians per second
    const maxTurnRate = 6.0; // radians per second
    return baseTurnRate + (maxTurnRate - baseTurnRate) * urgency;
  }
  
  private applyGlidingPhysics(velocity: { vx: number; vy: number }): void {
    const horizontalSpeed = Math.abs(velocity.vx);
    const isClimbing = velocity.vy < 0;
    
    if (isClimbing && horizontalSpeed >= this._minSpeedForLift) {
      const availableLift = Math.min(horizontalSpeed * this._glideEfficiency, this._maxClimbRate);
      velocity.vy = Math.max(velocity.vy, -availableLift);
    }
  }
  
  private maintainMinimumSpeed(
    velocity: { vx: number; vy: number },
    currentSpeed: number,
    dtSec: number
  ): void {
    if (currentSpeed < this._horizontalSpeed * 0.5) {
      const newDirection = Math.atan2(velocity.vy, velocity.vx);
      const speedBoost = 1.0;
      velocity.vx += Math.cos(newDirection) * speedBoost * dtSec;
      velocity.vy += Math.sin(newDirection) * speedBoost * dtSec;
    }
  }
  
  private updateRotation(pose: any, velocity: { vx: number; vy: number }): void {
    if (Math.hypot(velocity.vx, velocity.vy) > 0.001) {
      const angleRad = Math.atan2(velocity.vy, velocity.vx);
      const angleDeg = (angleRad * 180) / Math.PI;
      pose.Rotation = angleDeg + 90; // Image points up, so add 90 degrees
    }
  }
  
  /**
   * Checks for collisions ahead by predicting future position
   * Returns steering direction to avoid collision
   */
  private checkCollisionAhead(dtSec: number): { avoid: boolean; steerX: number; steerY: number } {
    if (!this._item || !this._phys || !this._collisionHandler) {
      return { avoid: false, steerX: 0, steerY: 0 };
    }
    
    const pose = this._item.Pose;
    const pos = pose.Position;
    const size = pose.Size;
    
    // Calculate current velocity
    const velocity = this._phys.getVelocity();
    const vx = velocity.vx ?? 0;
    const vy = velocity.vy ?? 0;
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
          //console.log(`Collision ahead: steering away from boundary (${steerX}, ${steerY}), rotation = ${pose.Rotation}`);
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

