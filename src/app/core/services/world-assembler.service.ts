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
import { FollowItem } from '../rendering/transformers/follow-item';
import { StayUpright } from '../rendering/transformers/stay-upright';
import { KeyboardController } from '../rendering/transformers/keyboard-controller';
import { Avatar, Obstacle, Target } from '../models/game-items/stage-items';
import { StageItem, Transformer } from '../models/game-items/stage-item';
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
    const zoom = 1.0;
    return new Camera(initialPosition, zoom);
  }

  private createCollisionHandler(): CollisionHandler {
    const handler = new CollisionHandler(this.ticker);
    handler.setRestitutionDefault(0.85);
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

      if (obstacle.transformers && obstacle.transformers.length > 0) {
        obstacle.transformers.forEach(t => {
          if (t.Type === 'FollowItem') {
            this.attachFollowItem(obstacle, context, t.Params);
          } else if (t.Type === 'StayUpright') {
            this.attachStayUpright(obstacle, context, t.Params);
          }
        });
      }
      
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

    if (avatar.transformers && avatar.transformers.length > 0) {
      avatar.transformers.forEach(t => {
        if (t.Type === 'UserController') {
          this.attachAvatarController(avatar, context, t.Params);
        } else if (t.Type === 'FollowItem') {
          this.attachFollowItem(avatar, context, t.Params);
        } else if (t.Type === 'StayUpright') {
          this.attachStayUpright(avatar, context, t.Params);
        }
      });
    }

    if (physics.hasGravity) {
      this.attachGravity(avatar, context);
    }
    if (physics.canMove || physics.canRotate) {
      this.registerWithIntegrator(avatar, context);
    }
  }


  private attachAvatarController(
    avatar: Avatar,
    context: WorldContext,
    params?: UserControllerParams
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
      params ?? defaultParams
    );
    context.setAvatarController(controller);
  }

  private attachFollowItem(
    item: StageItem,
    context: WorldContext,
    params: any
  ): void {
    if (!params || !params.TargetId) return;

    let target: StageItem | undefined;
    if (params.TargetId === 'Avatar') {
      target = context.getAvatar();
    }

    if (target) {
      const follower = new FollowItem(this.ticker, item, {
        target: target,
        distance: params.Distance,
        maxSpeed: params.maxSpeed ?? params.MaxSpeed,
        direction: params.direction,
        force: params.force ?? params.Force
      });
      context.addFollower(follower);
    }
  }

  private attachStayUpright(
    item: StageItem,
    context: WorldContext,
    params: any
  ): void {
    const upright = new StayUpright(this.ticker, item, {
      latency: params?.latency ?? params?.Latency,
      maxAngle: params?.maxAngle ?? params?.MaxAngle,
      speed: params?.speed ?? params?.Speed,
      force: params?.force ?? params?.Force
    });
    context.addUpright(upright);
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
