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
    protected gridBackgroundImage: string = '';
    protected gridBackgroundRepeat: { Mode: string, TileSize: { X: number, Y: number } } | null = null;

    loadMap(map: GameMap): void {
        if (!map) return;

        this.currentMap = map;
        this.updateGridFromMap(map);
        this.applyDesignConfiguration(map);
        this.updateZoomLevelsFromMap(map);
        this.animator.setMap(map);
        this.animator.setCamera(this.camera);
        this.rebuildWorld(map);
    }

    private onTick(): void {
        this.worldContext?.updateCamera();
        const cameraDirty = this.worldContext?.isCameraDirty() ?? false;

        // Update animator camera reference if it changed
        if (this.camera) {
            this.animator.setCamera(this.camera);
        }

        if (cameraDirty) {
            // Camera changed - redraw all layers
            this.grid?.requestRedraw();
            this.animLayer?.requestRedraw();
            this.avatarsCanvas?.requestRedraw();
            this.worldContext?.clearCameraDirty();
        } else {
            // Camera didn't change - only redraw dynamic layers (items that might have moved)
            // Grid is static, so skip it when camera is stable
            this.animLayer?.requestRedraw();
            this.avatarsCanvas?.requestRedraw();
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
    private zoomLevels: number[] = [1.0, 2.0, 3.0, 4.0, 5.0]; // Default fallback
    
    // Double-tap detection for fullscreen
    private lastTapTime: number = 0;
    private lastTapPosition: { x: number; y: number } | null = null;
    private readonly DOUBLE_TAP_DELAY = 300; // ms
    private readonly DOUBLE_TAP_DISTANCE = 50; // pixels

    toggleZoom(): void {
        this.currentZoom = this.zoomLevels[this.currentZoomIndex];
        this.currentZoomIndex = (this.currentZoomIndex + 1) % this.zoomLevels.length;
        this.camera.setTarget(this.camera.getTargetCenter(), this.currentZoom);
        console.log('currentZoom', this.currentZoom, this.currentZoomIndex);
    }

    onTouchStart(event: TouchEvent): void {
        if (event.touches.length !== 1) return;
        
        const touch = event.touches[0];
        const currentTime = Date.now();
        const currentPosition = { x: touch.clientX, y: touch.clientY };

        // Check if this is a double-tap
        if (this.lastTapTime > 0 && 
            (currentTime - this.lastTapTime) < this.DOUBLE_TAP_DELAY &&
            this.lastTapPosition &&
            Math.hypot(currentPosition.x - this.lastTapPosition.x, 
                      currentPosition.y - this.lastTapPosition.y) < this.DOUBLE_TAP_DISTANCE) {
            // Double-tap detected - toggle fullscreen
            this.toggleFullscreen();
            event.preventDefault();
            this.lastTapTime = 0; // Reset to prevent triple-tap
            this.lastTapPosition = null;
        } else {
            // Store tap info for potential double-tap
            this.lastTapTime = currentTime;
            this.lastTapPosition = currentPosition;
        }
    }

    private toggleFullscreen(): void {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            const element = document.documentElement;
            if (element.requestFullscreen) {
                element.requestFullscreen().catch(err => {
                    console.error('Error attempting to enable fullscreen:', err);
                });
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    console.error('Error attempting to exit fullscreen:', err);
                });
            }
        }
    }

    private updateZoomLevelsFromMap(map: GameMap): void {
        if (map.zoomLevels && map.zoomLevels.length > 0) {
            this.zoomLevels = map.zoomLevels;
            // Find the index of the current zoom level in the zoom levels array
            // Use map.camera if available (from JSON), otherwise fall back to this.camera
            const currentZoomValue = map.camera?.getZoom() ?? this.camera?.getZoom() ?? 1.0;
            const index = this.zoomLevels.findIndex(z => Math.abs(z - currentZoomValue) < 0.01);
            this.currentZoomIndex = index >= 0 ? index : 0;
            this.currentZoom = this.zoomLevels[this.currentZoomIndex];
        }
    }

    private applyDesignConfiguration(map: GameMap): void {
        if (!map.design) return;

        const { Border, Color, Image, BackgroundRepeat } = map.design;

        if (Border.Width) this.gridLineWidth = Border.Width;
        if (Border.Color) this.gridColor = Border.Color;
        if (Border.Style) this.gridBorder = Border.Style;
        if (Color) this.gridBackgroundColor = Color;
        if (Image) this.gridBackgroundImage = Image;
        if (BackgroundRepeat && BackgroundRepeat.Mode) {
            this.gridBackgroundRepeat = {
                Mode: BackgroundRepeat.Mode,
                TileSize: {
                    X: BackgroundRepeat.TileSize?.X ?? 1,
                    Y: BackgroundRepeat.TileSize?.Y ?? 1
                }
            };
        } else {
            this.gridBackgroundRepeat = null;
        }
    }
}
