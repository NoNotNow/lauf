import {StageItem} from '../../models/game-items/stage-item';

export interface PhysicsState {
    vx: number;           // linear velocity x (cells/s)
    vy: number;           // linear velocity y (cells/s)
    omega: number;        // angular velocity (deg/s)
    mass: number;         // mass (arbitrary units, >0)
    restitution: number;  // 0..1 bounciness
    linearDamping: number; // damping factor
    angularDamping: number;
}

const DEFAULT_STATE: PhysicsState = {
    vx: 0,
    vy: 0,
    omega: 0,
    mass: 1,
    restitution: 0.85,
    linearDamping: 0,
    angularDamping: 0.1,
};

// Hidden storage for per-item physics state without touching serialization
const store = new WeakMap<StageItem, PhysicsState>();

function massFromItem(item: StageItem): number {
    if (item.Physics?.canMove === false) return 1e6; // Treat as infinite mass (static)
    if (item.Physics?.mass !== undefined) return item.Physics.mass;
    const sx = Number(item?.Pose?.Size?.x ?? 1);
    const sy = Number(item?.Pose?.Size?.y ?? 1);
    return Math.max(1e-6, sx * sy);
}

export class StageItemPhysics {
    static get(item: StageItem): PhysicsState {
        let s = store.get(item);
        if (!s) {
            const p = item.Physics;
            s = {
                ...DEFAULT_STATE,
                mass: massFromItem(item),
                restitution: p?.restitution ?? item.Physics.restitution ?? DEFAULT_STATE.restitution,
                linearDamping: p?.damping ?? DEFAULT_STATE.linearDamping,
                angularDamping: p?.damping ?? DEFAULT_STATE.angularDamping,
            };
            store.set(item, s);
        }
        return s;
    }

    static set(item: StageItem, partial: Partial<PhysicsState>): PhysicsState {
        const s = {...StageItemPhysics.get(item), ...partial} as PhysicsState;
        // ensure sane values
        s.mass = Math.max(1e-6, Number(s.mass) ?? 1);
        s.restitution = Math.min(1, Math.max(0, s.restitution ?? 0.85));
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

    // Moment of inertia for a rectangle about its center: I = (1/12) * m * (w^2 + h^2)
    // Units: m in arbitrary mass, w/h in cells, I in mass * cells^2
    static momentOfInertia(item: StageItem): number {
        const s = StageItemPhysics.get(item);
        const w = Math.max(0, Number(item?.Pose?.Size?.x ?? 0));
        const h = Math.max(0, Number(item?.Pose?.Size?.y ?? 0));
        // Use a high but finite mass for inertia if mass is "infinite" (1e6)
        // to avoid NaN/Infinity issues while still making it very hard to rotate
        const effectiveMass = Math.min(s.mass, 1e6);
        const I = (effectiveMass * (w * w + h * h)) / 12;
        return Math.max(1e-6, I);
    }

    static omegaDegToRadPerSec(omegaDeg: number): number {
        return (Number(omegaDeg) || 0) * Math.PI / 180;
    }

    static omegaRadToDegPerSec(omegaRad: number): number {
        return (Number(omegaRad) || 0) * 180 / Math.PI;
    }
}
