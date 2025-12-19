import { Injectable } from '@angular/core';
import { Map as GameMap } from '../models/map';
import { WorldContext } from '../models/world-context';
import { TickService } from './tick.service';
import { CollisionHandler } from '../rendering/collision-handler';
import { PhysicsIntegrator } from '../rendering/physics/physics-integrator';
import { AxisAlignedBoundingBox } from '../rendering/collision';
import { Rotator } from '../rendering/transformers/rotator';
import { Drifter } from '../rendering/transformers/drifter';
import { Gravity } from '../rendering/transformers/gravity';
import { KeyboardController } from '../rendering/transformers/keyboard-controller';
import { Obstacle, Avatar, Target } from '../models/game-items/stage-items';
import { StageItem } from '../models/game-items/stage-item';
import { Point } from '../models/point';
import { Camera } from '../rendering/camera';
import { UserControllerParams } from '../models/user-controller-params';

export interface WorldAssemblerConfig {
  enableCollisions: boolean;
}

/**
 * Assembles a game world from a GameMap by wiring up physics,
 * collisions, transformers, and controllers.
 */
@Injectable({ providedIn: 'root' })
export class WorldAssemblerService {
  constructor(private ticker: TickService) {}

  buildWorld(map: GameMap, config: WorldAssemblerConfig): WorldContext {
    const context = new WorldContext();
    const boundary = this.createBoundary(map.size);

    // Setup physics integrator first so items can register with it during assembly
    const integrator = this.createPhysicsIntegrator(boundary);
    context.setIntegrator(integrator);

    // Setup collision handler
    if (config.enableCollisions) {
      const collisions = this.createCollisionHandler();
      context.setCollisionHandler(collisions);
    }

    // Assemble avatar
    if (map.avatar) {
      this.assembleAvatar(
        map.avatar,
        context,
        boundary
      );
      context.setAvatar(map.avatar);
    }

    // Setup camera
    const camera = this.createCamera(map);
    context.setCamera(camera);

    // Assemble obstacles with their transformers
    this.assembleObstacles(map.obstacles ?? [], context, boundary);

    return context;
  }

  private createBoundary(gridSize?: Point): AxisAlignedBoundingBox | undefined {
    if (!gridSize) return undefined;
    return { minX: 0, minY: 0, maxX: gridSize.x, maxY: gridSize.y };
  }

  private createCamera(map: GameMap): Camera {
    if (map.camera) return map.camera;

    const avatarPos = map.avatar?.Pose?.Position;
    const initialPosition = avatarPos ?? new Point(5, 5);
    const visibleCells = 50;
    return new Camera(initialPosition, visibleCells);
  }

  private createCollisionHandler(): CollisionHandler {
    const handler = new CollisionHandler(this.ticker);
    handler.setRestitutionDefault(1.0); // Perfectly elastic collisions
    return handler;
  }

  private createPhysicsIntegrator(
    boundary?: AxisAlignedBoundingBox
  ): PhysicsIntegrator {
    const integrator = new PhysicsIntegrator(this.ticker);
    if (boundary) {
      integrator.setBoundary(boundary, true);
    }
    return integrator;
  }

  private assembleObstacles(
    obstacles: Obstacle[],
    context: WorldContext,
    boundary?: AxisAlignedBoundingBox
  ): void {
    obstacles.forEach(obstacle => {
      const physics = obstacle.Physics;
      if (physics.hasCollision) {
        this.wireCollision(obstacle, context);
      }
      // if (physics.canRotate) {
      //   this.attachRotator(obstacle, context);
      // }
      // if (physics.canMove) {
      //   this.attachDrifter(obstacle, context, boundary);
      // }
      if (physics.hasGravity) {
        this.attachGravity(obstacle, context);
      }
      if (physics.canMove || physics.canRotate) {
        this.registerWithIntegrator(obstacle, context);
      }
    });
  }

  private wireCollision(item: StageItem, context: WorldContext): void {
    context.getCollisionHandler()?.add(item);
  }

  private attachRotator(item: StageItem, context: WorldContext): void {
    const speed = this.randomRotationSpeed();
    const direction = this.randomDirection();

    const rotator = new Rotator(this.ticker, item, speed, direction);
    context.addRotator(rotator);
  }

  private attachDrifter(
    item: StageItem,
    context: WorldContext,
    boundary?: AxisAlignedBoundingBox
  ): void {
    const maxSpeed = this.randomDriftSpeed();
    const vel = this.randomVelocity(maxSpeed);
    const vx = vel.vx;
    const vy = vel.vy;

    const drifter = new Drifter(this.ticker, item, maxSpeed, boundary, true);
    drifter.setVelocity(vx, vy);
    context.addDrifter(drifter);
  }

  private attachGravity(item: StageItem, context: WorldContext): void {
    const gravity = new Gravity(this.ticker, item, 0.5);
    context.addGravity(gravity);
  }

  private registerWithIntegrator(item: StageItem, context: WorldContext): void {
    context.getIntegrator()?.add(item);
  }

  private assembleAvatar(
    avatar: Avatar,
    context: WorldContext,
    boundary?: AxisAlignedBoundingBox
  ): void {
    const physics = avatar.Physics;
    if (physics.hasCollision) {
      this.wireCollision(avatar, context);
    }
    this.attachAvatarController(avatar, context);
    if (physics.hasGravity) {
      this.attachGravity(avatar, context);
    }
    if (physics.canMove || physics.canRotate) {
      this.registerWithIntegrator(avatar, context);
    }
  }


  private attachAvatarController(
    avatar: Avatar,
    context: WorldContext
  ): void {
    const defaultParams: UserControllerParams = {
      linearAccel: 2.5,
      linearBrake: 2.0,
      linearDamping: 0.2,
      maxSpeed: 8.0,
      angularAccel: 600,
      angularDamping: 600,
      maxOmega: 240,
    };

    const controller = new KeyboardController(
      this.ticker,
      avatar,
      avatar.controllerParams ?? defaultParams
    );
    context.setAvatarController(controller);
  }

  // Random generation helpers
  private randomRotationSpeed(): number {
    return 5 + Math.random() * 25; // 5..30 deg/s
  }

  private randomDirection(): 1 | -1 {
    return Math.random() < 0.5 ? -1 : 1;
  }

  private randomDriftSpeed(): number {
    return 0.02 + Math.random() * 15; // 0.02..~15.02 cells/s
  }

  private randomVelocity(maxSpeed: number): { vx: number; vy: number } {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * (maxSpeed / 2);
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  }
}
