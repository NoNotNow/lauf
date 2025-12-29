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
    currentZoomIndex: number = 0;

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
        this.startup.main(this);
        this.ticker.start();
        this.tickSub = this.ticker.ticks$.subscribe(() => this.onTick());
    }

    ngOnDestroy(): void {
        this.tickSub?.unsubscribe?.();
        this.ticker.stop();
        this.worldContext?.cleanup();
        this.animator.destroy();
    }

    protected gridBackgroundColor: string = 'transparent';

    loadMap(map: GameMap): void {
        if (!map) return;

        this.currentMap = map;
        this.updateGridFromMap(map);
        this.applyDesignConfiguration(map);
        this.animator.setMap(map);
        this.rebuildWorld(map);
    }

    private onTick(): void {
        this.worldContext?.updateCamera();
        const cameraDirty = this.worldContext?.isCameraDirty() ?? false;

        if (cameraDirty) {
            this.grid?.requestRedraw();
        }

        // Obstacles and avatars are dynamic now, redraw every frame
        this.animLayer?.requestRedraw();
        this.avatarsCanvas?.requestRedraw();

        if (cameraDirty) {
            this.worldContext?.clearCameraDirty();
        }
    }


    private updateGridFromMap(map: GameMap): void {
        if (map.size) {
            this.gridSize = new Point(map.size.x, map.size.y);
        }
    }

    private rebuildWorld(map: GameMap): void {
        this.worldContext?.cleanup();
        this.worldContext = this.worldAssembler.buildWorld(map, {
            enableCollisions: this.enableItemCollisions
        });
        this.worldContext.start();
    }

    private currentZoom = 1.0;
    private zoomLevels = [1.0, 2.0, 3.0, 4.0, 5.0];
    toggleZoom(): void {
        this.currentZoom = this.zoomLevels[this.currentZoomIndex];
        this.currentZoomIndex = (this.currentZoomIndex + 1) % this.zoomLevels.length;
        this.camera.setTarget(this.camera.getTargetCenter(), this.currentZoom);
        console.log('currentZoom', this.currentZoom, this.currentZoomIndex);
    }

    private applyDesignConfiguration(map: GameMap): void {
        if (!map.design) return;

        const { Border, Color } = map.design;

        if (Border.Width) this.gridLineWidth = Border.Width;
        if (Border.Color) this.gridColor = Border.Color;
        if (Border.Style) this.gridBorder = Border.Style;
        if (Color) this.gridBackgroundColor = Color;
    }
}
