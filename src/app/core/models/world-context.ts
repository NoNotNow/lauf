import { Rotator } from '../rendering/transformers/rotator';
import { Wobbler } from '../rendering/transformers/wobbler';
import { Drifter } from '../rendering/transformers/drifter';
import { Gravity } from '../rendering/transformers/gravity';
import { KeyboardController } from '../rendering/transformers/keyboard-controller';
import { CollisionHandler } from '../rendering/collision-handler';
import { PhysicsIntegrator } from '../rendering/physics/physics-integrator';
import { Camera } from '../rendering/camera';

/**
 * Container for all game systems assembled by WorldAssembler.
 * Manages lifecycle of transformers, physics, controllers, and camera.
 */
export class WorldContext {
  private rotators: Rotator[] = [];
  private wobblers: Wobbler[] = [];
  private drifters: Drifter[] = [];
  private gravities: Gravity[] = [];
  private avatarController?: KeyboardController;
  private integrator?: PhysicsIntegrator;
  private collisions?: CollisionHandler;
  private camera?: Camera;
  private avatar?: any;

  addRotator(rotator: Rotator): void {
    this.rotators.push(rotator);
  }

  addWobbler(wobbler: Wobbler): void {
    this.wobblers.push(wobbler);
  }

  addDrifter(drifter: Drifter): void {
    this.drifters.push(drifter);
  }

  addGravity(gravity: Gravity): void {
    this.gravities.push(gravity);
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

  getCamera(): Camera | undefined {
    return this.camera;
  }

  getCollisionHandler(): CollisionHandler | undefined {
    return this.collisions;
  }

  getIntegrator(): PhysicsIntegrator | undefined {
    return this.integrator;
  }

  setAvatar(avatar: any): void {
    this.avatar = avatar;
  }

  updateCamera(): void {
    if (this.camera && this.avatar) {
      this.camera.setTarget(this.avatar.Pose.Position, 5.0);
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
    this.drifters.forEach(d => d.start());
    this.gravities.forEach(g => g.start());
    this.avatarController?.start();
    this.collisions?.start();
    this.integrator?.start();
  }

  stop(): void {
    this.rotators.forEach(r => r.stop());
    this.wobblers.forEach(w => w.stop());
    this.drifters.forEach(d => d.stop());
    this.gravities.forEach(g => g.stop());
    this.avatarController?.stop();
    this.integrator?.stop();
    this.collisions?.stop();
  }

  cleanup(): void {
    this.stop();
    this.rotators = [];
    this.wobblers = [];
    this.drifters = [];
    this.gravities = [];
    this.avatarController = undefined;
    this.collisions?.clear();
    this.integrator = undefined;
    this.collisions = undefined;
  }
}
