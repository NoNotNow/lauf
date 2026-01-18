import { StageItem } from '../../models/game-items/stage-item';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { ITransformer } from './transformer.interface';
import { getWalkingInputState } from './walking-input';

export interface WalkingControllerOptions {
  restitution?: number;
  angularDamping?: number;
}

export class WalkingController implements ITransformer {
  private _item?: StageItem;
  private keys = new Set<string>();
  private started = false;
  private params?: WalkingControllerOptions;

  constructor(item?: StageItem, params?: WalkingControllerOptions) {
    this._item = item;
    this.params = params;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    this.applyPhysicsParams();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.applyPhysicsParams();
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = normalizeKey(e);
    if (k != null) e.preventDefault();
    if (!k) return;
    if (this.keys.has(k)) return;
    this.keys.add(k);
    this.updateMoveAxis();
    if (isJumpKey(k)) {
      const state = this.getInputState();
      if (!state.jumpHeld) {
        state.jumpQueued = true;
      }
      state.jumpHeld = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = normalizeKey(e);
    if (!k) return;
    this.keys.delete(k);
    this.updateMoveAxis();
    if (isJumpKey(k)) {
      const state = this.getInputState();
      state.jumpHeld = false;
      state.jumpQueued = false;
    }
  };

  private updateMoveAxis(): void {
    const state = this.getInputState();
    const leftHeld = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const rightHeld = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    state.moveAxis = leftHeld === rightHeld ? 0 : leftHeld ? -1 : 1;
  }

  private applyPhysicsParams(): void {
    if (!this._item || !this.params) return;
    const { restitution, angularDamping } = this.params;
    if (restitution !== undefined) {
      this._item.Physics.restitution = Number(restitution);
    }
    if (angularDamping !== undefined) {
      this._item.Physics.angularDamping = Number(angularDamping);
    }
    if (restitution !== undefined || angularDamping !== undefined) {
      const physics = StageItemPhysics.for(this._item);
      physics.set({
        restitution: restitution ?? physics.State.restitution,
        angularDamping: angularDamping ?? physics.State.angularDamping
      });
    }
  }

  private getInputState() {
    if (!this._item) {
      return { moveAxis: 0, jumpQueued: false, jumpHeld: false };
    }
    return getWalkingInputState(this._item);
  }
}

function normalizeKey(e: KeyboardEvent): string | null {
  const code = e.code;
  switch (code) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'KeyW':
    case 'KeyA':
    case 'KeyS':
    case 'KeyD':
      return code;
    default:
      return null;
  }
}

function isJumpKey(code: string): boolean {
  return code === 'ArrowUp' || code === 'KeyW';
}
