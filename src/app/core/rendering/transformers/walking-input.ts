import { StageItem } from '../../models/game-items/stage-item';

export interface WalkingInputState {
  moveAxis: -1 | 0 | 1;
  jumpQueued: boolean;
  jumpHeld: boolean;
}

const store = new WeakMap<StageItem, WalkingInputState>();

export function getWalkingInputState(item: StageItem): WalkingInputState {
  let state = store.get(item);
  if (!state) {
    state = { moveAxis: 0, jumpQueued: false, jumpHeld: false };
    store.set(item, state);
  }
  return state;
}
