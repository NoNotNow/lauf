import { Injectable } from '@angular/core';
import { Map as GameMap } from '../models/map';
import { WorldContext } from '../models/world-context';
import { TickService } from './tick.service';
import { CollisionHandler } from '../rendering/collision-handler';
import { PhysicsIntegrator } from '../rendering/physics/physics-integrator';
import { AxisAlignedBoundingBox } from '../rendering/collision';
import { Rotator } from '../rendering/transformers/rotator';
import { Wobbler } from '../rendering/transformers/wobbler';
import { Glider } from '../rendering/transformers/glider';
import { Drifter } from '../rendering/transformers/drifter';
import { Gravity } from '../rendering/transformers/gravity';
import { FollowItem } from '../rendering/transformers/follow-item';
import { StayUpright } from '../rendering/transformers/stay-upright';
import { KeyboardController } from '../rendering/transformers/keyboard-controller';
import { Avatar, Obstacle } from '../models/game-items/stage-items';
import { StageItem, Transformer } from '../models/game-items/stage-item';
import { Point } from '../models/point';
import { Camera } from '../rendering/camera';
import { UserControllerParams } from '../models/user-controller-params';
import { Glider2 } from '../rendering/transformers/glider2';

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

  private readonly transformerHandlers: Record<
    string,
    (item: StageItem, context: WorldContext, params: any, boundary?: AxisAlignedBoundingBox) => void
  > = {
    UserController: (item, context, params) =>
      this.attachAvatarController(item as Avatar, context, params),
    FollowItem: (item, context, params) =>
      this.attachFollowItem(item, context, params),
    StayUpright: (item, context, params) =>
      this.attachStayUpright(item, context, params),
    Glider: (item, context, params, boundary) =>
      this.attachGlider(item, context, params, boundary),
    Glider2: (item, context, params) => this.attachGlider2(item, context, params),
    Rotator: (item, context) => this.attachRotator(item, context),
    Drifter: (item, context, _params, boundary) =>
      this.attachDrifter(item, context, boundary),
    Wobbler: (item, context, params) => this.attachWobbler(item, context, params),
  };

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
      this.assembleItem(map.avatar, context, boundary);
      context.setAvatar(map.avatar);
    }

    // Setup camera
    const camera = this.createCamera(map);
    context.setCamera(camera);

    if (map.size) {
      context.setCameraBounds(map.size.x, map.size.y);
    }

    // Assemble obstacles with their transformers
    (map.obstacles ?? []).forEach(obstacle => this.assembleItem(obstacle, context, boundary));

    return context;
  }

  private assembleItem(
    item: StageItem,
    context: WorldContext,
    boundary?: AxisAlignedBoundingBox
  ): void {
    const physics = item.Physics;

    if (physics.hasCollision) {
      this.wireCollision(item, context);
    }

    item.transformers?.forEach(t => this.attachTransformer(item, context, t, boundary));

    if (physics.hasGravity) {
      this.attachGravity(item, context);
    }

    if (physics.canMove || physics.canRotate) {
      this.registerWithIntegrator(item, context);
    }
  }

  private attachTransformer(
    item: StageItem,
    context: WorldContext,
    transformer: Transformer,
    boundary?: AxisAlignedBoundingBox
  ): void {
    const handler = this.transformerHandlers[transformer.Type];
    if (handler) {
      handler(item, context, transformer.Params, boundary);
    }
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

  private wireCollision(item: StageItem, context: WorldContext): void {
    context.getCollisionHandler()?.add(item);
  }

  private attachRotator(item: StageItem, context: WorldContext): void {
    const speed = this.randomRotationSpeed();
    const direction = this.randomDirection();

    const rotator = new Rotator(this.ticker, item, speed, direction);
    context.addTransformer(rotator);
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
    context.addTransformer(drifter);
  }

  private attachWobbler(item: StageItem, context: WorldContext, params: any): void {
    const amplitude = params?.amplitude ?? params?.Amplitude ?? 0.15;
    const frequency = params?.frequency ?? params?.Frequency ?? 0.5;
    const wobbler = new Wobbler(this.ticker, item, amplitude, frequency);
    context.addTransformer(wobbler);
  }

  private attachGravity(item: StageItem, context: WorldContext): void {
    const gravity = new Gravity(this.ticker, item, 0.5);
    context.addTransformer(gravity);
  }

  private attachGlider2(item: StageItem, context: WorldContext, params: any) {
    const glider2 = new Glider2(this.ticker, params);
    context.addTransformer(glider2);
  }

  private attachGlider(item: StageItem, context: WorldContext, params?: any, boundary?: AxisAlignedBoundingBox): void {
    const horizontalSpeed = params?.horizontalSpeed ?? params?.horizontalAmplitude ?? 2.0;
    const glideEfficiency = params?.glideEfficiency ?? 0.3;
    const minSpeedForLift = params?.minSpeedForLift ?? 1.0;
    const maxClimbRate = params?.maxClimbRate ?? 3.0;
    const minDistanceToBoundary = params?.minDistanceToBoundary ?? params?.minDistanceToBottom ?? 1.0;
    const boundaryAvoidanceStrength = params?.boundaryAvoidanceStrength ?? 3.0;
    const lookAheadDistance = params?.lookAheadDistance ?? 2.0;
    const lookAheadTime = params?.lookAheadTime ?? 0.5;
    const collisionAvoidanceStrength = params?.collisionAvoidanceStrength ?? 4.0;
    
    const glider = new Glider(
      this.ticker, 
      item, 
      horizontalSpeed, 
      glideEfficiency, 
      minSpeedForLift, 
      maxClimbRate,
      boundary,
      context.getCollisionHandler(),
      minDistanceToBoundary,
      boundaryAvoidanceStrength,
      lookAheadDistance,
      lookAheadTime,
      collisionAvoidanceStrength
    );
    context.addTransformer(glider);
  }

  private registerWithIntegrator(item: StageItem, context: WorldContext): void {
    context.getIntegrator()?.add(item);
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
    context.addTransformer(controller);
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
      const follower = new FollowItem(this.ticker, item,target, {

        distance: params.Distance,
        maxSpeed: params.maxSpeed ?? params.MaxSpeed,
        direction: params.direction,
        force: params.force ?? params.Force
      });
      context.addTransformer(follower);
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
    context.addTransformer(upright);
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
