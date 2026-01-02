import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TickService } from './tick.service';
import { WorldContextService } from './world-context.service';
import { AnimatorService } from '../rendering/animator.service';
import { Camera } from '../rendering/camera';
import { Map as GameMap } from '../models/map';
import { GridGeometry } from '../models/canvas-geometry';

export interface RenderLayer {
    requestRedraw(): void;
}

@Injectable({ providedIn: 'root' })
export class RenderingCoordinatorService implements OnDestroy {
    private tickSub?: Subscription;
    private layers: Set<RenderLayer> = new Set();
    private gridLayer?: RenderLayer;
    private obstaclesLayer?: RenderLayer;
    private avatarsLayer?: RenderLayer;
    private currentMap?: GameMap;

    constructor(
        private ticker: TickService,
        private worldContextService: WorldContextService,
        private animator: AnimatorService
    ) {}

    registerGridLayer(layer: RenderLayer): void {
        this.gridLayer = layer;
        this.layers.add(layer);
    }

    registerObstaclesLayer(layer: RenderLayer): void {
        this.obstaclesLayer = layer;
        this.layers.add(layer);
    }

    registerAvatarsLayer(layer: RenderLayer): void {
        this.avatarsLayer = layer;
        this.layers.add(layer);
    }

    unregisterLayer(layer: RenderLayer): void {
        this.layers.delete(layer);
        if (this.gridLayer === layer) this.gridLayer = undefined;
        if (this.obstaclesLayer === layer) this.obstaclesLayer = undefined;
        if (this.avatarsLayer === layer) this.avatarsLayer = undefined;
    }

    setMap(map: GameMap): void {
        this.currentMap = map;
        this.animator.setMap(map);
    }

    setCamera(camera: Camera | undefined): void {
        this.animator.setCamera(camera);
    }

    createObstaclesDrawCallback(): (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: GridGeometry) => void {
        return (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: GridGeometry) => {
            if (!geom) return;
            this.animator.draw(ctx, geom);
        };
    }

    createAvatarsDrawCallback(): (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: GridGeometry) => void {
        return (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, geom?: GridGeometry) => {
            if (!geom || !this.currentMap?.avatar) return;
            this.animator.drawItems([this.currentMap.avatar], ctx, geom);
        };
    }

    start(): void {
        if (this.tickSub) return;
        this.ticker.start();
        this.tickSub = this.ticker.ticks$.subscribe(() => this.onTick());
    }

    stop(): void {
        this.tickSub?.unsubscribe();
        this.tickSub = undefined;
        this.ticker.stop();
    }

    private onTick(): void {
        const camera = this.worldContextService.getCamera();
        
        // Update camera reference in animator if it changed
        if (camera) {
            this.animator.setCamera(camera);
        }

        // Update camera state
        this.worldContextService.updateCamera();
        const cameraDirty = this.worldContextService.isCameraDirty();

        if (cameraDirty) {
            // Camera changed - redraw all layers
            this.gridLayer?.requestRedraw();
            this.obstaclesLayer?.requestRedraw();
            this.avatarsLayer?.requestRedraw();
            this.worldContextService.clearCameraDirty();
        } else {
            // Camera didn't change - only redraw dynamic layers
            this.obstaclesLayer?.requestRedraw();
            this.avatarsLayer?.requestRedraw();
        }
    }

    ngOnDestroy(): void {
        this.stop();
        this.layers.clear();
        this.gridLayer = undefined;
        this.obstaclesLayer = undefined;
        this.avatarsLayer = undefined;
    }
}

