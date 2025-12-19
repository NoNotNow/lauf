import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {GridComponent} from '../grid/grid.component';
import {Point} from '../../../../core/models/point';
import {Map as GameMap} from '../../../../core/models/map';
import {StartupService, MapLoader} from '../../../../core/services/startup.service';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
import {AnimatorService} from '../../../../core/rendering/animator.service';
import {TickService} from '../../../../core/services/tick.service';
import {Rotator} from '../../../../core/rendering/transformers/rotator';
import {Wobbler} from '../../../../core/rendering/transformers/wobbler';
import {Drifter} from '../../../../core/rendering/transformers/drifter';
import {Gravity} from '../../../../core/rendering/transformers/gravity';
import {KeyboardController} from '../../../../core/rendering/transformers/keyboard-controller';
import {CollisionHandler} from '../../../../core/rendering/collision-handler';
import {AxisAlignedBoundingBox} from '../../../../core/rendering/collision';
import {PhysicsIntegrator} from '../../../../core/rendering/physics/physics-integrator';
import {Camera} from '../../../../core/rendering/camera';

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [GridComponent, CanvasLayerComponent],
    providers: [],
    templateUrl: './map.component.html',
    styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit, OnDestroy, MapLoader {
    // Configure grid appearance
    gridColor = '#cccccc';
    gridLineWidth = 0.01; // in cell units (1.0 == one cell)
    gridSize: Point = new Point(10, 10);
    gridBorder = "solid";

    camera = new Camera(new Point(5, 5), 15);

    @ViewChild(GridComponent)
    grid!: GridComponent;

    @ViewChild(CanvasLayerComponent)
    animLayer!: CanvasLayerComponent;

    // Avatar layer is now canvas-based to use the same renderer as obstacles
    @ViewChild('avatarsCanvas')
    avatarsCanvas!: CanvasLayerComponent;

    // Draw callback for the animator-driven obstacles layer
    drawFrame = (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: any) => {
        if (!geom) return;
        this.animator.draw(ctx, geom);
    };

    // Draw callback for the avatar canvas layer using the same bitmap pipeline
    drawAvatarFrame = (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: any) => {
        if (!geom || !this.currentMap?.avatar) return;
        this.animator.drawItems([this.currentMap.avatar], ctx, geom);
    };

    private tickSub?: any;
    private rotators: Rotator[] = [];
    private wobblers: Wobbler[] = [];
    private drifters: Drifter[] = [];
    private gravities: Gravity[] = [];
    private avatarController?: KeyboardController;
    private collisions?: CollisionHandler;
    private integrator?: PhysicsIntegrator;
    enableItemCollisions = true;
    private currentMap?: GameMap;

    // Helper to compute current grid boundary in cell coordinates
    private getGridBoundary(): AxisAlignedBoundingBox | undefined {
        return this.gridSize
            ? { minX: 0, minY: 0, maxX: this.gridSize.x, maxY: this.gridSize.y }
            : undefined;
    }

    constructor(
    private startup: StartupService,
    private animator: AnimatorService,
    private ticker: TickService
  ) {
    if (this.enableItemCollisions) {
      this.collisions = new CollisionHandler(this.ticker);
      // Ensure perfectly elastic item–item collisions by default
      this.collisions.setRestitutionDefault(1.0);
    }
  }

    ngAfterViewInit(): void {
        // Trigger startup to load and provide the Map to this component
        this.startup.main(this);
        // Start ticking and request redraw on each frame
        this.ticker.start();
        this.tickSub = this.ticker.ticks$.subscribe(() => {
            if (this.currentMap?.avatar) {
                this.camera.setTarget(this.currentMap.avatar.Pose.Position, 5.0); // Zoom in on avatar
            }
            this.camera.update();

            const cameraDirty = this.camera.isDirty;

            // Only redraw static layers if the camera moved
            if (cameraDirty) {
                this.grid?.requestRedraw();
                this.animLayer?.requestRedraw();
            }

            // Avatar might still be moving even if camera is stationary (though usually camera follows avatar)
            // For now, always redraw avatar layer if we want to be safe, or check if avatar moved.
            // Given the avatar is one item, redrawing it is cheap.
            this.avatarsCanvas?.requestRedraw();

            if (cameraDirty) {
                this.camera.clearDirty();
            }
        });
        if (this.enableItemCollisions) {
            this.collisions?.start();
        }
    }

    ngOnDestroy(): void {
        this.tickSub?.unsubscribe?.();
        this.ticker.stop();
        this.rotators.forEach(r => r.stop());
        this.wobblers.forEach(w => w.stop());
        this.drifters.forEach(d => d.stop());
        this.gravities.forEach(g => g.stop());
        this.avatarController?.stop();
        this.animator.destroy();
        this.collisions?.stop();
        this.integrator?.stop();
    }

    // Accepts a Map object and applies it to the grid, obstacles, and game items layers
    protected gridBackgroundColor: string = 'transparent';
    loadMap(m: GameMap): void {
        console.log('Loaded map:', m);
        if (!m) return;
        this.currentMap = m;
        // Update grid size from map
        if (m.size) {
            this.gridSize = new Point(m.size.x, m.size.y);
        }

        if(m.design) {
            if(m.design.Border.Width) this.gridLineWidth = m.design?.Border.Width
            if(m.design.Border.Color) this.gridColor = m.design?.Border.Color;
            if(m.design.Border.Style) this.gridBorder = m.design?.Border.Style;
            if(m.design.Color) this.gridBackgroundColor = m.design?.Color;
        }

        // Provide map to animator (obstacles drawn via canvas layer per tick)
        this.animator.setMap(m);

        // Stop existing transformers if reloading a map
        this.rotators.forEach(r => r.stop());
        this.wobblers.forEach(w => w.stop());
        this.drifters.forEach(d => d.stop());
        this.gravities.forEach(g => g.stop());
        this.rotators = [];
        this.wobblers = [];
        this.drifters = [];
        this.gravities = [];
        this.avatarController?.stop();
        this.avatarController = undefined;
        this.collisions?.clear();
        this.integrator?.stop();
        this.integrator = new PhysicsIntegrator(this.ticker);

        // Give every obstacle its own rotator and drifter with random parameters
        const obstacles = m.obstacles ?? [];
        const boundary: AxisAlignedBoundingBox | undefined = this.getGridBoundary();
        this.integrator.setBoundary(boundary, true);
        for (const obstacle of obstacles) {
            // register obstacle into collision handler first (obstacles only)
            if (this.enableItemCollisions) {
                this.collisions?.add(obstacle);
            }
            // Random rotation parameters
            const speed = 5 + Math.random() * 25; // 5..30 deg/s
            const dir: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
            const rot = new Rotator(this.ticker, obstacle, speed, dir);
            rot.start();
            this.rotators.push(rot);
            {
                // Drifter: slow random drift with bouncing inside grid bounds
                const maxSpeed = 0.02 + Math.random() * 15; // 0.02..~2.02 cells/s
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * maxSpeed/2; // random magnitude up to max
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                const drift = new Drifter(this.ticker, obstacle, maxSpeed, boundary, true);
                drift.setVelocity(vx, vy);
                drift.start();
                this.drifters.push(drift);
            }
            {
                // Gravity: apply constant downward acceleration
                const grav = new Gravity(this.ticker, obstacle, .5);
                grav.start();
                this.gravities.push(grav);
            }
            // Integrate obstacle pose from physics
            this.integrator.add(obstacle);
        }
        this.integrator.start();


        // Load avatar: keyboard-controlled movement + physics; rendering handled by avatarsCanvas draw callback
        if (m.avatar) {
            // Give the avatar its own movement and physics similar to obstacles
            const boundary: AxisAlignedBoundingBox | undefined = this.getGridBoundary();
            if (this.enableItemCollisions) {
                this.collisions?.add(m.avatar);
            }
            // Keyboard controller: arrow keys/WASD control avatar velocities
            this.avatarController = new KeyboardController(this.ticker, m.avatar, {
                linearAccel: 2.5,
                linearBrake: 2.0,
                linearDamping: .2,
                maxSpeed: 8.0,
                angularAccel: 600,
                angularDamping: 600,
                maxOmega: 240,
            });
            this.avatarController.start();
            
            {
                // Gravity for avatar
                const grav = new Gravity(this.ticker, m.avatar, .5);
                grav.start();
                this.gravities.push(grav);
            }

            // Integrate avatar pose from physics
            this.integrator?.add(m.avatar);
        }
    }
}
