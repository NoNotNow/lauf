import {AfterViewInit, ChangeDetectorRef, Component, OnDestroy, ViewChild} from '@angular/core';
import {GridComponent} from '../grid/grid.component';
import {Map as GameMap} from '../../../../core/models/map';
import {StartupService, MapLoader} from '../../../../core/services/startup.service';
import { CanvasLayerComponent } from '../../../../shared/components/common/canvas-layer/canvas-layer.component';
import {MapConfigurationService} from '../../../../core/services/map-configuration.service';
import {ZoomService} from '../../../../core/services/zoom.service';
import {FullscreenService} from '../../../../core/services/fullscreen.service';
import {RenderingCoordinatorService} from '../../../../core/services/rendering-coordinator.service';
import {WorldContextService} from '../../../../core/services/world-context.service';
import {AnimatorService} from '../../../../core/rendering/animator.service';

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [GridComponent, CanvasLayerComponent],
    providers: [],
    templateUrl: './map.component.html',
    styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit, OnDestroy, MapLoader {
    // Grid configuration from service
    get gridConfig() {
        return this.mapConfig.config;
    }

    // Camera accessor for template
    get camera() {
        return this.worldContextService.getCamera();
    }

    // Zoom state accessors for template
    get currentZoom() {
        return this.zoomService.getCurrentZoom();
    }

    get currentZoomIndex() {
        return this.zoomService.getCurrentZoomIndex();
    }

    @ViewChild(GridComponent)
    grid!: GridComponent;

    @ViewChild(CanvasLayerComponent)
    animLayer!: CanvasLayerComponent;

    // Avatar layer is now canvas-based to use the same renderer as obstacles
    @ViewChild('avatarsCanvas')
    avatarsCanvas!: CanvasLayerComponent;

    // Draw callbacks from rendering coordinator (cached for stability)
    private _drawFrame?: (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: any) => void;
    private _drawAvatarFrame?: (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: any) => void;

    get drawFrame() {
        if (!this._drawFrame) {
            this._drawFrame = this.renderingCoordinator.createObstaclesDrawCallback();
        }
        return this._drawFrame;
    }

    get drawAvatarFrame() {
        if (!this._drawAvatarFrame) {
            this._drawAvatarFrame = this.renderingCoordinator.createAvatarsDrawCallback();
        }
        return this._drawAvatarFrame;
    }

    enableItemCollisions = true;
    private configSub?: any;

    constructor(
        private startup: StartupService,
        private mapConfig: MapConfigurationService,
        private zoomService: ZoomService,
        private fullscreenService: FullscreenService,
        private renderingCoordinator: RenderingCoordinatorService,
        private worldContextService: WorldContextService,
        private animator: AnimatorService,
        private cdr: ChangeDetectorRef
    ) {}

    ngAfterViewInit(): void {
        // Register layers with rendering coordinator
        this.renderingCoordinator.registerGridLayer(this.grid);
        this.renderingCoordinator.registerObstaclesLayer(this.animLayer);
        this.renderingCoordinator.registerAvatarsLayer(this.avatarsCanvas);

        // Subscribe to configuration changes to trigger change detection
        // Grid component will pick up changes via inputs
        this.configSub = this.mapConfig.config$.subscribe(() => {
            this.cdr.markForCheck();
        });

        // Start the rendering coordinator
        this.renderingCoordinator.start();

        // Load map
        this.startup.main(this);
    }

    ngOnDestroy(): void {
        this.configSub?.unsubscribe?.();
        this.renderingCoordinator.stop();
        this.renderingCoordinator.unregisterLayer(this.grid);
        this.renderingCoordinator.unregisterLayer(this.animLayer);
        this.renderingCoordinator.unregisterLayer(this.avatarsCanvas);
        this.worldContextService.cleanup();
        this.animator.destroy();
    }

    loadMap(map: GameMap): void {
        if (!map) return;

        // Configure map settings via services
        this.mapConfig.loadMap(map);
        this.zoomService.loadZoomLevelsFromMap(map);

        // Set up rendering coordinator
        this.renderingCoordinator.setMap(map);

        // Build world (creates or uses camera from map)
        this.worldContextService.setConfig({ enableCollisions: this.enableItemCollisions });
        this.worldContextService.buildWorld(map);

        // Get camera from world context (it's created or set during buildWorld)
        const camera = this.worldContextService.getCamera();
        if (camera) {
            // Set camera references in services that need it
            this.zoomService.setCamera(camera);
            this.renderingCoordinator.setCamera(camera);
        }
    }

    toggleZoom(): void {
        this.zoomService.toggleZoom();
    }

    onTouchStart(event: TouchEvent): void {
        const fullscreenToggled = this.fullscreenService.handleTouchStart(event);
        if (fullscreenToggled) {
            event.preventDefault();
        }
    }
}
