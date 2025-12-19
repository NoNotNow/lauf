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
import { Obstacle } from '../models/game-items/stage-items';
import { Point } from '../models/point';
import { Camera } from '../rendering/camera';

export interface WorldAssemblerConfig {
  enableCollisions: boolean;
  gridSize?: Point;
  cameraInitialPosition?: Point;
  cameraVisibleCells?: number;
  avatarControllerParams?: {
    linearAccel: number;
    linearBrake: number;
    linearDamping: number;
    maxSpeed: number;
    angularAccel: number;
    angularDamping: number;
    maxOmega: number;
  };
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
    const boundary = this.createBoundary(config.gridSize);

    // Setup camera
    const camera = this.createCamera(config);
    context.setCamera(camera);

    // Setup collision handler
    if (config.enableCollisions) {
      const collisions = this.createCollisionHandler();
      context.setCollisionHandler(collisions);
    }

    // Setup physics integrator
    const integrator = this.createPhysicsIntegrator(boundary);
    context.setIntegrator(integrator);

    // Assemble obstacles with their transformers
    this.assembleObstacles(map.obstacles ?? [], context, boundary);

    // Assemble avatar with controller
    if (map.avatar) {
      this.assembleAvatar(
        map.avatar,
        context,
        boundary,
        config.avatarControllerParams
      );
      context.setAvatar(map.avatar);
    }

    return context;
  }

  private createBoundary(gridSize?: Point): AxisAlignedBoundingBox | undefined {
    if (!gridSize) return undefined;
    return { minX: 0, minY: 0, maxX: gridSize.x, maxY: gridSize.y };
  }

  private createCamera(config: WorldAssemblerConfig): Camera {
    const initialPosition = config.cameraInitialPosition ?? new Point(5, 5);
    const visibleCells = config.cameraVisibleCells ?? 15;
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
      this.wireObstacleCollision(obstacle, context);
      this.attachRotator(obstacle, context);
      this.attachDrifter(obstacle, context, boundary);
      this.attachGravity(obstacle, context);
      this.registerWithIntegrator(obstacle, context);
    });
  }

  private wireObstacleCollision(obstacle: Obstacle, context: WorldContext): void {
    // Access private collision handler through getter (if available)
    // For now, we'll assume context provides access
    const handler = (context as any).collisions as CollisionHandler | undefined;
    handler?.add(obstacle);
  }

  private attachRotator(obstacle: Obstacle, context: WorldContext): void {
    const speed = this.randomRotationSpeed();
    const direction = this.randomDirection();
    const rotator = new Rotator(this.ticker, obstacle, speed, direction);
    context.addRotator(rotator);
  }

  private attachDrifter(
    obstacle: Obstacle,
    context: WorldContext,
    boundary?: AxisAlignedBoundingBox
  ): void {
    const maxSpeed = this.randomDriftSpeed();
    const { vx, vy } = this.randomVelocity(maxSpeed);

    const drifter = new Drifter(this.ticker, obstacle, maxSpeed, boundary, true);
    drifter.setVelocity(vx, vy);
    context.addDrifter(drifter);
  }

  private attachGravity(obstacle: Obstacle, context: WorldContext): void {
    const gravity = new Gravity(this.ticker, obstacle, 0.5);
    context.addGravity(gravity);
  }

  private registerWithIntegrator(obstacle: Obstacle, context: WorldContext): void {
    const integrator = (context as any).integrator as PhysicsIntegrator | undefined;
    integrator?.add(obstacle);
  }

  private assembleAvatar(
    avatar: any,
    context: WorldContext,
    boundary?: AxisAlignedBoundingBox,
    controllerParams?: any
  ): void {
    this.wireAvatarCollision(avatar, context);
    this.attachAvatarController(avatar, context, controllerParams);
    this.attachGravity(avatar, context);
    this.registerWithIntegrator(avatar, context);
  }

  private wireAvatarCollision(avatar: any, context: WorldContext): void {
    const handler = (context as any).collisions as CollisionHandler | undefined;
    handler?.add(avatar);
  }

  private attachAvatarController(
    avatar: any,
    context: WorldContext,
    params?: any
  ): void {
    const defaultParams = {
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
      params ?? defaultParams
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
