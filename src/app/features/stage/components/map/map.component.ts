import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {GridComponent} from '../grid/grid.component';
import {Point} from '../../../../core/models/point';
import {Map as GameMap} from '../../../../core/models/map';
import {StartupService, MapLoader} from '../../../../core/services/startup.service';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
import {AnimatorService} from '../../../../core/rendering/animator.service';
import {TickService} from '../../../../core/services/tick.service';
import {WorldAssemblerService} from '../../../../core/services/world-assembler.service';
import {WorldContext} from '../../../../core/models/world-context';

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

    // Camera accessor for template
    get camera() {
        return this.worldContext?.getCamera();
    }

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
    private worldContext?: WorldContext;
    enableItemCollisions = true;
    private currentMap?: GameMap;

    constructor(
        private startup: StartupService,
        private animator: AnimatorService,
        private ticker: TickService,
        private worldAssembler: WorldAssemblerService
    ) {}

    ngAfterViewInit(): void {
        // Trigger startup to load and provide the Map to this component
        this.startup.main(this);
        // Start ticking and request redraw on each frame
        this.ticker.start();
        this.tickSub = this.ticker.ticks$.subscribe(() => {
            // Update camera following avatar
            this.worldContext?.updateCamera();

            const cameraDirty = this.worldContext?.isCameraDirty() ?? false;

            // Only redraw static layers if the camera moved
            if (cameraDirty) {
                this.grid?.requestRedraw();
                this.animLayer?.requestRedraw();
            }

            // Always redraw avatar layer (cheap operation)
            this.avatarsCanvas?.requestRedraw();

            if (cameraDirty) {
                this.worldContext?.clearCameraDirty();
            }
        });
    }

    ngOnDestroy(): void {
        this.tickSub?.unsubscribe?.();
        this.ticker.stop();
        this.worldContext?.cleanup();
        this.animator.destroy();
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

        // Apply visual design configuration
        this.applyDesignConfiguration(m);

        // Provide map to animator (obstacles drawn via canvas layer per tick)
        this.animator.setMap(m);

        // Cleanup previous world if reloading
        this.worldContext?.cleanup();

        // Assemble the game world with all systems
        this.worldContext = this.worldAssembler.buildWorld(m, {
            enableCollisions: this.enableItemCollisions,
            gridSize: this.gridSize,
        });

        // Start all game systems
        this.worldContext.start();
    }

    private applyDesignConfiguration(map: GameMap): void {
        if (!map.design) return;

        if (map.design.Border.Width) {
            this.gridLineWidth = map.design.Border.Width;
        }
        if (map.design.Border.Color) {
            this.gridColor = map.design.Border.Color;
        }
        if (map.design.Border.Style) {
            this.gridBorder = map.design.Border.Style;
        }
        if (map.design.Color) {
            this.gridBackgroundColor = map.design.Color;
        }
    }
}
