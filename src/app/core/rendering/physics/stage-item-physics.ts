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

// Hidden storage for per-item physics instances without touching serialization
const store = new WeakMap<StageItem, StageItemPhysics>();

function massFromItem(item: StageItem): number {
    if (item.Physics?.canMove === false) return 1e6; // Treat as infinite mass (static)
    if (item.Physics?.mass !== undefined) return item.Physics.mass;
    const sx = Number(item?.Pose?.Size?.x ?? 1);
    const sy = Number(item?.Pose?.Size?.y ?? 1);
    return Math.max(1e-6, sx * sy);
}

export class StageItemPhysics {
    private state: PhysicsState;
    private item: StageItem;

    //add public getter for state
    public get State(): PhysicsState {
        return this.state;
    }

    // Getters for pose properties
    public get Position() {
        return this.item?.Pose?.Position;
    }

    public get Size() {
        return this.item?.Pose?.Size;
    }

    public get Rotation() {
        return this.item?.Pose?.Rotation ?? 0;
    }

    private constructor(item: StageItem) {
        this.item = item;
        const p = item.Physics;
        this.state = {
            ...DEFAULT_STATE,
            mass: massFromItem(item),
            restitution: p?.restitution ?? DEFAULT_STATE.restitution,
            linearDamping: p?.damping ?? DEFAULT_STATE.linearDamping,
            angularDamping: p?.damping ?? DEFAULT_STATE.angularDamping,
        };
    }

    // Static factory method to get or create physics instance for an item
    static for(item: StageItem): StageItemPhysics {
        let instance = store.get(item);
        if (!instance) {
            instance = new StageItemPhysics(item);
            store.set(item, instance);
        }
        return instance;
    }

    set(partial: Partial<PhysicsState>): this {
        Object.assign(this.state, partial);
        // ensure sane values
        this.state.mass = Math.max(1e-6, Number(this.state.mass) ?? 1);
        this.state.restitution = Math.min(1, Math.max(0, this.state.restitution ?? 0.85));
        return this;
    }

    getVelocity(): { vx: number; vy: number } {
        return {vx: this.state.vx, vy: this.state.vy};
    }

    setVelocity(vx: number, vy: number): this {
        this.state.vx = Number(vx) || 0;
        this.state.vy = Number(vy) || 0;
        return this;
    }

    accelerate(ax: number, ay: number, dt: number): this {
        this.state.vx += ax * dt;
        this.state.vy += ay * dt;
        return this;
    }

    getAngularVelocity(): number {
        return this.state.omega;
    }

    setAngularVelocity(omega: number): this {
        this.state.omega = Number(omega) || 0;
        return this;
    }

    accelerateAngular(alpha: number, dt: number): this {
        this.state.omega += alpha * dt;
        return this;
    }


    // Moment of inertia for a rectangle about its center: I = (1/12) * m * (w^2 + h^2)
    // Units: m in arbitrary mass, w/h in cells, I in mass * cells^2
    momentOfInertia(item: StageItem): number {
        const w = Math.max(0, Number(item?.Pose?.Size?.x ?? 0));
        const h = Math.max(0, Number(item?.Pose?.Size?.y ?? 0));
        // Use a high but finite mass for inertia if mass is "infinite" (1e6)
        // to avoid NaN/Infinity issues while still making it very hard to rotate
        const effectiveMass = Math.min(this.state.mass, 1e6);
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
