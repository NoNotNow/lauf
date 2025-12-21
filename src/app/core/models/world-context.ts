import { Rotator } from '../rendering/transformers/rotator';
import { Wobbler } from '../rendering/transformers/wobbler';
import { Sailor } from '../rendering/transformers/sailor';
import { Drifter } from '../rendering/transformers/drifter';
import { Gravity } from '../rendering/transformers/gravity';
import { FollowItem } from '../rendering/transformers/follow-item';
import { StayUpright } from '../rendering/transformers/stay-upright';
import { KeyboardController } from '../rendering/transformers/keyboard-controller';
import { CollisionHandler } from '../rendering/collision-handler';
import { PhysicsIntegrator } from '../rendering/physics/physics-integrator';
import { Camera } from '../rendering/camera';
import { Avatar } from './game-items/stage-items';

/**
 * Container for all game systems assembled by WorldAssembler.
 * Manages lifecycle of transformers, physics, controllers, and camera.
 */
export class WorldContext {
  private rotators: Rotator[] = [];
  private wobblers: Wobbler[] = [];
  private sailors: Sailor[] = [];
  private drifters: Drifter[] = [];
  private gravities: Gravity[] = [];
  private followers: FollowItem[] = [];
  private uprights: StayUpright[] = [];
  private avatarController?: KeyboardController;
  private integrator?: PhysicsIntegrator;
  private collisions?: CollisionHandler;
  private camera?: Camera;
  private avatar?: Avatar;

  addRotator(rotator: Rotator): void {
    this.rotators.push(rotator);
  }

  addWobbler(wobbler: Wobbler): void {
    this.wobblers.push(wobbler);
  }

  addSailor(sailor: Sailor): void {
    this.sailors.push(sailor);
  }

  addDrifter(drifter: Drifter): void {
    this.drifters.push(drifter);
  }

  addGravity(gravity: Gravity): void {
    this.gravities.push(gravity);
  }

  addFollower(follower: FollowItem): void {
    this.followers.push(follower);
  }

  addUpright(upright: StayUpright): void {
    this.uprights.push(upright);
  }

  setAvatarController(controller: KeyboardController): void {
    this.avatarController = controller;
  }

  setIntegrator(integrator: PhysicsIntegrator): void {
    this.integrator = integrator;
  }

  setCollisionHandler(handler: CollisionHandler): void {
    this.collisions = handler;
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  setCameraBounds(cols: number, rows: number): void {
    this.camera?.setBounds(cols, rows);
  }

  getCamera(): Camera | undefined {
    return this.camera;
  }

  getCollisionHandler(): CollisionHandler | undefined {
    return this.collisions;
  }

  getIntegrator(): PhysicsIntegrator | undefined {
    return this.integrator;
  }

  setAvatar(avatar: Avatar): void {
    this.avatar = avatar;
  }

  getAvatar(): Avatar | undefined {
    return this.avatar;
  }

  updateCamera(): void {
    if (this.camera && this.avatar) {
      this.camera.setTarget(this.avatar.Pose.Position, this.camera.getTargetZoom());
      this.camera.update();
    }
  }

  isCameraDirty(): boolean {
    return this.camera?.isDirty ?? false;
  }

  clearCameraDirty(): void {
    this.camera?.clearDirty();
  }

  start(): void {
    this.rotators.forEach(r => r.start());
    this.wobblers.forEach(w => w.start());
    this.sailors.forEach(s => s.start());
    this.drifters.forEach(d => d.start());
    this.gravities.forEach(g => g.start());
    this.followers.forEach(f => f.start());
    this.uprights.forEach(u => u.start());
    this.avatarController?.start();
    this.collisions?.start();
    this.integrator?.start();
  }

  stop(): void {
    this.rotators.forEach(r => r.stop());
    this.wobblers.forEach(w => w.stop());
    this.sailors.forEach(s => s.stop());
    this.drifters.forEach(d => d.stop());
    this.gravities.forEach(g => g.stop());
    this.followers.forEach(f => f.stop());
    this.uprights.forEach(u => u.stop());
    this.avatarController?.stop();
    this.integrator?.stop();
    this.collisions?.stop();
  }

  cleanup(): void {
    this.stop();
    this.rotators = [];
    this.wobblers = [];
    this.sailors = [];
    this.drifters = [];
    this.gravities = [];
    this.followers = [];
    this.uprights = [];
    this.avatarController = undefined;
    this.collisions?.clear();
    this.integrator = undefined;
    this.collisions = undefined;
  }
}
