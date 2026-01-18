import { StageItem } from '../../models/game-items/stage-item';
import { ITransformer } from './transformer.interface';
import { getWalkingInputState } from './walking-input';

export class WalkingController implements ITransformer {
  private _item?: StageItem;
  private keys = new Set<string>();
  private started = false;

  constructor(item?: StageItem) {
    this._item = item;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
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
