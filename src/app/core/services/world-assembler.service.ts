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
import { StageItem } from '../models/game-items/stage-item';
import { Point } from '../models/point';
import { Camera } from '../rendering/camera';
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
      context.addTransformer(new KeyboardController(this.ticker, item, params)),
    FollowItem: (item, context, params) => {
      const target = params?.TargetId === 'Avatar' ? context.getAvatar() : undefined;
      if (target) {
        context.addTransformer(new FollowItem(this.ticker, item, target, params));
      }
    },
    StayUpright: (item, context, params) =>
      context.addTransformer(new StayUpright(this.ticker, item, params)),
    Glider: (item, context, params, boundary) =>
      context.addTransformer(new Glider(this.ticker, item, params, boundary, context.getCollisionHandler())),
    Glider2: (item, context, params) => context.addTransformer(new Glider2(this.ticker,item,  params)),
    Rotator: (item, context, params) => context.addTransformer(new Rotator(this.ticker, item, params)),
    Drifter: (item, context, params, boundary) =>
      context.addTransformer(new Drifter(this.ticker, item, params, boundary)),
    Wobbler: (item, context, params) => context.addTransformer(new Wobbler(this.ticker, item, params)),
  };

  buildWorld(map: GameMap, config: WorldAssemblerConfig): WorldContext {
    const context = new WorldContext();
    const boundary = this.createBoundary(map.size);

    context.setIntegrator(this.createPhysicsIntegrator(boundary));

    if (config.enableCollisions) {
      context.setCollisionHandler(this.createCollisionHandler());
    }

    if (map.avatar) {
      this.assembleItem(map.avatar, context, boundary);
      context.setAvatar(map.avatar);
    }

    context.setCamera(this.createCamera(map));
    if (map.size) {
      context.setCameraBounds(map.size.x, map.size.y);
    }

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
      context.getCollisionHandler()?.add(item);
    }

    item.transformers?.forEach(t => {
      const handler = this.transformerHandlers[t.Type];
      if (handler) {
        handler(item, context, t.Params, boundary);
      }
    });

    if (physics.hasGravity) {
      context.addTransformer(new Gravity(this.ticker, item));
    }

    if (physics.canMove || physics.canRotate) {
      context.getIntegrator()?.add(item);
    }
  }

  private createBoundary(gridSize?: Point): AxisAlignedBoundingBox | undefined {
    if (!gridSize) return undefined;
    return { minX: 0, minY: 0, maxX: gridSize.x, maxY: gridSize.y };
  }

  private createCamera(map: GameMap): Camera {
    if (map.camera) return map.camera;
    const initialPosition = map.avatar?.Pose?.Position ?? new Point(5, 5);
    return new Camera(initialPosition, 1.0);
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
}
