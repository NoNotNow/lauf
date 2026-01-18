import { ITransformer } from '../rendering/transformers/transformer.interface';
import { CollisionHandler } from '../rendering/collision-handler';
import { PhysicsIntegrator } from '../rendering/physics/physics-integrator';
import { Camera } from '../rendering/camera';
import { Avatar } from './game-items/stage-items';

/**
 * Container for all game systems assembled by WorldAssembler.
 * Manages lifecycle of transformers, physics, controllers, and camera.
 */
export class WorldContext {
  private transformers: ITransformer[] = [];
  
  private integrator?: PhysicsIntegrator;
  private collisions?: CollisionHandler;
  private camera?: Camera;
  private avatar?: Avatar;
  private mapGravity?: number; // Gravity acceleration in cells/s^2

  addTransformer(transformer: ITransformer): void {
    this.transformers.push(transformer);
  }

  setAvatarController(controller: ITransformer): void {
    this.addTransformer(controller);
  }

  getTransformers(): ITransformer[] {
    return this.transformers;
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

  setMapGravity(gravity?: number): void {
    this.mapGravity = gravity;
  }

  getMapGravity(): number | undefined {
    return this.mapGravity;
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
    this.transformers.forEach(t => t.start());
    this.collisions?.start();
    this.integrator?.start();
  }

  stop(): void {
    this.transformers.forEach(t => t.stop());
    this.integrator?.stop();
    this.collisions?.stop();
  }

  cleanup(): void {
    this.stop();
    this.transformers = [];
    this.collisions?.clear();
    this.integrator = undefined;
    this.collisions = undefined;
  }
}
