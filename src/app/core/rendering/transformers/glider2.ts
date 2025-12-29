import { Subscription } from 'rxjs';
import { StageItem } from "../../models/game-items/stage-item";
import { TickService } from "../../services/tick.service";
import { StageItemPhysics } from "../physics/stage-item-physics";
import { ITransformer } from "./transformer.interface";

/**
 * Realistic 2D glider plane physics simulation.
 * 
 * Physics model:
 * - Lift: proportional to speed² and angle of attack (AoA)
 * - Drag: parasitic drag (v²) + induced drag (AoA dependent)
 * - Gravity: constant downward acceleration
 * - Natural stability: plane pitches to maintain equilibrium speed
 * 
 * The glider will naturally find a stable glide angle where lift balances gravity
 * and drag balances the forward component of gravity.
 */
export class Glider2 implements ITransformer {
    private sub?: Subscription;
    private _params: GliderParams;
    private _physics: StageItemPhysics;

    constructor(
        private tickerService: TickService,
        item: StageItem,
        params?: Partial<GliderParams>
    ) {
        this._physics = StageItemPhysics.for(item);
        this._params = this.initializeParams(params);

        // Initialize velocity if needed
        if (this._params.initialSpeed > 0) {
            const angleRad = (this._params.initialGlideAngle * Math.PI) / 180;
            const vx = this._params.initialSpeed * Math.cos(angleRad);
            const vy = this._params.initialSpeed * Math.sin(angleRad);
            this._physics.setVelocity(vx, vy);
        }
    }

    private initializeParams(params?: Partial<GliderParams>): GliderParams {
        const defaults: GliderParams = {
            // Geometry
            frontDirection: -90, // degrees: direction the nose points when rotation=0 (0 = up, 90 = right)

            // Physics constants
            gravityMagnitude: 2.0, // cells/s² - downward acceleration
            airDensity: 1.0, // relative air density (affects lift/drag scaling)

            // Aerodynamics
            liftCoefficient: 0.15, // base lift coefficient (per unit AoA)
            maxLiftAoA: 15.0, // degrees: angle of attack for maximum lift (stall angle)
            stallAoA: 20.0, // degrees: angle where lift drops significantly
            parasiticDragCoefficient: 0.02, // base drag coefficient (v² dependent)
            inducedDragCoefficient: 0.05, // induced drag coefficient (AoA dependent)

            // Stability and control
            equilibriumSpeed: 2.0, // cells/s: target speed for stable flight
            pitchStabilityGain: 0.0, // how strongly the plane pitches to maintain speed
            maxPitchRate: 120.0, // degrees/s: maximum pitch rate
            angularDamping: 3.0, // angular damping coefficient

            // Initial conditions
            initialSpeed: 2.0, // cells/s: initial forward speed
            initialGlideAngle: -10.0, // degrees: initial glide angle (negative = descending)
        };

        return { ...defaults, ...params };
    }

    start(): void {
        if (this.sub) return;
        this.sub = this.tickerService.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
    }

    stop(): void {
        this.sub?.unsubscribe();
        this.sub = undefined;
    }

    onTick(dtSec: number): void {
        if (dtSec === 0) return;

        // Get current state
        const velocity = this._physics.getVelocity();
        const vx = velocity.vx;
        const vy = velocity.vy;
        const speed = Math.hypot(vx, vy);

        // Skip calculations if speed is too low (avoid division by zero)
        if (speed < 0.01) {
            // Apply gravity only
            this._physics.accelerate(0, this._params.gravityMagnitude, dtSec);
            return;
        }

        // Calculate velocity direction (radians, 0 = right, π/2 = down)
        const velocityAngle = Math.atan2(vy, vx);

        // Get current rotation (degrees)
        const rotationDeg = this._physics.Rotation;
        const rotationRad = (rotationDeg * Math.PI) / 180;

        // Calculate angle of attack (AoA)
        // AoA is the angle between the wing chord (plane's forward direction) and the relative wind (velocity)
        const forwardDirectionRad = rotationRad + (this._params.frontDirection * Math.PI) / 180;
        let angleOfAttackRad = forwardDirectionRad - velocityAngle;

        // Normalize AoA to [-π, π]
        while (angleOfAttackRad > Math.PI) angleOfAttackRad -= 2 * Math.PI;
        while (angleOfAttackRad < -Math.PI) angleOfAttackRad += 2 * Math.PI;

        const angleOfAttackDeg = (angleOfAttackRad * 180) / Math.PI;

        // Calculate aerodynamic forces
        const { liftMagnitude, dragMagnitude } = this.calculateAerodynamicForces(
            speed,
            angleOfAttackDeg
        );

        // Lift acts perpendicular to velocity (90° to the right of velocity direction)
        const liftDirection = velocityAngle + Math.PI / 2;
        const liftAx = liftMagnitude * Math.cos(liftDirection);
        const liftAy = liftMagnitude * Math.sin(liftDirection);

        // Drag acts opposite to velocity
        const dragAx = -dragMagnitude * Math.cos(velocityAngle);
        const dragAy = -dragMagnitude * Math.sin(velocityAngle);

        // Apply aerodynamic forces
        this._physics.accelerate(liftAx + dragAx, liftAy + dragAy, dtSec);

        // Apply gravity
        this._physics.accelerate(0, this._params.gravityMagnitude, dtSec);

        // Apply natural pitch stability (plane pitches to maintain equilibrium speed)
        this.applyPitchStability(speed, angleOfAttackDeg, dtSec);

        // Apply angular damping
        const angularVelocity = this._physics.getAngularVelocity();
        const dampingTorque = -angularVelocity * this._params.angularDamping;
        this._physics.accelerateAngular(dampingTorque, dtSec);
    }

    /**
     * Calculate lift and drag forces based on speed and angle of attack.
     * Uses simplified aerodynamic model:
     * - Lift: L = 0.5 * ρ * v² * S * Cl(α)
     * - Drag: D = 0.5 * ρ * v² * S * (Cd_parasitic + Cd_induced(α))
     */
    private calculateAerodynamicForces(
        speed: number,
        angleOfAttackDeg: number
    ): { liftMagnitude: number; dragMagnitude: number } {
        const speedSquared = speed * speed;
        const airDensity = this._params.airDensity;

        // Calculate lift coefficient based on angle of attack
        // Linear relationship up to maxLiftAoA, then decreases (stall)
        let liftCoefficient: number;
        const absAoA = Math.abs(angleOfAttackDeg);

        if (absAoA < this._params.maxLiftAoA) {
            // Linear lift curve
            liftCoefficient = this._params.liftCoefficient * absAoA;
        } else if (absAoA < this._params.stallAoA) {
            // Approaching stall - lift decreases
            const stallProgress = (absAoA - this._params.maxLiftAoA) / 
                                 (this._params.stallAoA - this._params.maxLiftAoA);
            const maxLift = this._params.liftCoefficient * this._params.maxLiftAoA;
            liftCoefficient = maxLift * (1 - stallProgress * 0.5);
        } else {
            // Deep stall - significant lift loss
            liftCoefficient = this._params.liftCoefficient * this._params.maxLiftAoA * 0.3;
        }

        // Lift direction depends on AoA sign
        if (angleOfAttackDeg < 0) {
            liftCoefficient = -liftCoefficient;
        }

        // Calculate lift force (simplified: L = 0.5 * ρ * v² * Cl)
        const liftMagnitude = 0.5 * airDensity * speedSquared * liftCoefficient;

        // Calculate drag
        // Parasitic drag: D_parasitic = 0.5 * ρ * v² * Cd_parasitic
        const parasiticDrag = 0.5 * airDensity * speedSquared * this._params.parasiticDragCoefficient;

        // Induced drag: D_induced = 0.5 * ρ * v² * Cd_induced * AoA²
        // (increases with angle of attack)
        const inducedDrag = 0.5 * airDensity * speedSquared * 
                           this._params.inducedDragCoefficient * 
                           (absAoA * absAoA) / (this._params.maxLiftAoA * this._params.maxLiftAoA);

        const dragMagnitude = parasiticDrag + inducedDrag;

        return { liftMagnitude, dragMagnitude };
    }

    /**
     * Apply natural pitch stability.
     * The plane naturally pitches to maintain equilibrium speed:
     * - Too fast → pitch up (reduce speed)
     * - Too slow → pitch down (increase speed)
     */
    private applyPitchStability(
        speed: number,
        angleOfAttackDeg: number,
        dtSec: number
    ): void {
        const speedError = speed - this._params.equilibriumSpeed;
        const speedErrorNormalized = speedError / this._params.equilibriumSpeed;

        // Calculate desired pitch rate based on speed error
        // Positive speed error (too fast) → negative pitch rate (pitch up)
        // Negative speed error (too slow) → positive pitch rate (pitch down)
        let desiredPitchRate = -speedErrorNormalized * this._params.pitchStabilityGain * 
                              this._params.maxPitchRate;

        // Limit pitch rate
        desiredPitchRate = Math.max(
            -this._params.maxPitchRate,
            Math.min(this._params.maxPitchRate, desiredPitchRate)
        );

        // Apply pitch torque (convert degrees/s to angular acceleration)
        // We apply this as an angular acceleration
        const currentAngularVelocity = this._physics.getAngularVelocity();
        const angularAcceleration = (desiredPitchRate - currentAngularVelocity) * 2.0; // response factor
        this._physics.accelerateAngular(angularAcceleration, dtSec);
    }
}

/**
 * Configuration parameters for the glider.
 */
interface GliderParams {
    // Geometry
    frontDirection: number; // degrees: direction nose points when rotation=0

    // Physics constants
    gravityMagnitude: number; // cells/s²
    airDensity: number; // relative air density

    // Aerodynamics
    liftCoefficient: number; // base lift coefficient
    maxLiftAoA: number; // degrees: angle of attack for maximum lift
    stallAoA: number; // degrees: stall angle
    parasiticDragCoefficient: number; // base drag coefficient
    inducedDragCoefficient: number; // induced drag coefficient

    // Stability and control
    equilibriumSpeed: number; // cells/s: target speed
    pitchStabilityGain: number; // pitch stability strength
    maxPitchRate: number; // degrees/s: maximum pitch rate
    angularDamping: number; // angular damping coefficient

    // Initial conditions
    initialSpeed: number; // cells/s: initial speed
    initialGlideAngle: number; // degrees: initial glide angle
}
