import {StageItem} from '../../models/game-items/stage-item';

export interface PhysicsState {
    vx: number;           // linear velocity x (cells/s)
    vy: number;           // linear velocity y (cells/s)
    omega: number;        // angular velocity (deg/s)
    mass: number;         // mass (arbitrary units, >0)
    restitution: number;  // 0..1 bounciness
}

const DEFAULT_STATE: PhysicsState = {
    vx: 0,
    vy: 0,
    omega: 0,
    mass: 1,
    restitution: 1.0,
};

// Hidden storage for per-item physics state without touching serialization
const store = new WeakMap<StageItem, PhysicsState>();

function massFromItem(item: StageItem): number {
    const sx = Number(item?.Pose?.Size?.x ?? 1);
    const sy = Number(item?.Pose?.Size?.y ?? 1);
    return Math.max(1e-6, sx * sy);
}

export class StageItemPhysics {
    static get(item: StageItem): PhysicsState {
        let s = store.get(item);
        if (!s) {
            s = {...DEFAULT_STATE, mass: massFromItem(item)};
            store.set(item, s);
        }
        return s;
    }

    static set(item: StageItem, partial: Partial<PhysicsState>): PhysicsState {
        const s = {...StageItemPhysics.get(item), ...partial} as PhysicsState;
        // ensure sane values
        s.mass = Math.max(1e-6, Number(s.mass) || 1);
        s.restitution = Math.min(1, Math.max(0, Number(s.restitution) || 1.0));
        store.set(item, s);
        return s;
    }

    static getVelocity(item: StageItem): { vx: number; vy: number } {
        const s = StageItemPhysics.get(item);
        return {vx: s.vx, vy: s.vy};
    }

    static setVelocity(item: StageItem, vx: number, vy: number): PhysicsState {
        return StageItemPhysics.set(item, {vx: Number(vx) || 0, vy: Number(vy) || 0});
    }

    static getAngular(item: StageItem): number {
        return StageItemPhysics.get(item).omega;
    }

    static setAngular(item: StageItem, omega: number): PhysicsState {
        return StageItemPhysics.set(item, {omega: Number(omega) || 0});
    }
}
