import { StageItem } from "../../models/game-items/stage-item";
import { TickService } from "../../services/tick.service";
import { StageItemPhysics } from "../physics/stage-item-physics";
import { ITransformer } from "./transformer.interface";

export class Glider2 implements ITransformer {
    private sub?: any;
    private _params: any;
    private _physics: StageItemPhysics;
    constructor(private tickerService: TickService,item:StageItem, params?: any) { 
        this._params = params || {};
        this._physics = StageItemPhysics.for(item);


        //temp code for initial testing
        this._physics.setVelocity(0.0, 0); //initial forward speed
        this._params['frontDirection'] = 0; //the head is pointing up when rotation is 0
        this._params['gravityMagnitude'] = 1; //cells/s²
        this._params['liftCoefficient'] = 0.1; //lift coefficient
        this._params['dragCoefficient'] = 0.1; //drag coefficient
        this._params['neutralSpeed'] = 1; //when speed is faster the glider tilts upwards, when slower it tilts downwards
        this._params['angularDamping'] = 5; //angular damping factor
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
        let angle = this._physics.Rotation;

        //determin current velocity to determin lift direction
        let velocityX = this._physics.State.vx;
        let velocityY = this._physics.State.vy;
        let velocityAngle = Math.atan2(velocityY, velocityX) * 180 / Math.PI; //in degrees
        
        //calculate angle of attack
        let angleOfAttack = velocityAngle - angle - this._params['frontDirection'];
        //normalize to -180..180
        angleOfAttack = ((angleOfAttack + 180) % 360) - 180;

        let speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        //calculate lift force
        let liftMagnitude = this._params['gravityMagnitude'] * Math.sin(angleOfAttack * Math.PI / 180); //simplified lift calculation
        liftMagnitude *= speed * this._params['liftCoefficient']; //lift increases with speed
        //calculate lift direction (perpendicular to velocity)
        let liftDirection = velocityAngle + 90; //in degrees

        //convert lift force to acceleration
        let liftAx = (liftMagnitude * Math.cos(liftDirection * Math.PI / 180));
        let liftAy = (liftMagnitude * Math.sin(liftDirection * Math.PI / 180));

        //apply lift acceleration
        this._physics.accelerate(liftAx, liftAy, dtSec);

        //apply angular damping
        let angularVelocity = this._physics.getAngularVelocity();
        let angularDampingTorque = -angularVelocity * this._params['angularDamping'];
        this._physics.accelerateAngular(angularDampingTorque, dtSec);

        //apply gravity
        let gravityMagnitude = this._params['gravityMagnitude'];
        this._physics.accelerate(0, gravityMagnitude, dtSec);

        //apply momentum conversion to align velocity with heading
        let headingDirection = angle + this._params['frontDirection']-90;
        let momentumMagnitude = speed * 0.6; //adjust momentum conversion factor as needed
        let momentumAx = (momentumMagnitude * Math.cos(headingDirection * Math.PI / 180));
        let momentumAy = (momentumMagnitude * Math.sin(headingDirection * Math.PI / 180));
        this._physics.accelerate(momentumAx, momentumAy, dtSec);

        //apply drag (simplified)
        let dragMagnitude = speed * this._params['dragCoefficient'];
        let dragDirection = velocityAngle + 180; //opposite to velocity
        let dragAx = (dragMagnitude * Math.cos(dragDirection * Math.PI / 180));
        let dragAy = (dragMagnitude * Math.sin(dragDirection * Math.PI / 180));
        this._physics.accelerate(dragAx, dragAy, dtSec);

        //adjust tilt based on speed
        let rot=(speed - this._params['neutralSpeed'])*10; //tilt factor
        if ((speed - this._params['neutralSpeed']) > 0.1) { //faster
            //only if angular velocity is not too high already
            if(this._physics.getAngularVelocity()>-300)
                this._physics.accelerateAngular(-300, dtSec); //pull nose up
        } else if ((speed - this._params['neutralSpeed']) < -0.1) {//slower
            //todo: only if nose is not already pointing downwards  
            if(this.noseDirection()<130)         
                this._physics.accelerateAngular(50, dtSec);
        }  

    }

    private noseDirection(): number {
        return this._physics.Rotation + this._params['frontDirection'];
    }
}