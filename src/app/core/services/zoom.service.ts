import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Map as GameMap } from '../models/map';
import { Camera } from '../rendering/camera';

@Injectable({ providedIn: 'root' })
export class ZoomService {
    private zoomLevels: number[] = [1.0, 2.0, 3.0, 4.0, 5.0]; // Default fallback
    private currentZoomIndex: number = 0;
    private currentZoom = 1.0;
    private camera?: Camera;

    private zoomSubject = new BehaviorSubject<{ zoom: number; index: number }>({ 
        zoom: this.currentZoom, 
        index: this.currentZoomIndex 
    });
    public readonly zoom$: Observable<{ zoom: number; index: number }> = this.zoomSubject.asObservable();

    setCamera(camera: Camera | undefined): void {
        this.camera = camera;
    }

    getZoomLevels(): number[] {
        return [...this.zoomLevels];
    }

    getCurrentZoom(): number {
        return this.currentZoom;
    }

    getCurrentZoomIndex(): number {
        return this.currentZoomIndex;
    }

    loadZoomLevelsFromMap(map: GameMap): void {
        if (map.zoomLevels && map.zoomLevels.length > 0) {
            this.zoomLevels = map.zoomLevels;
            
            // Find the index of the current zoom level
            const currentZoomValue = map.camera?.getZoom() ?? this.camera?.getZoom() ?? 1.0;
            const index = this.zoomLevels.findIndex(z => Math.abs(z - currentZoomValue) < 0.01);
            this.currentZoomIndex = index >= 0 ? index : 0;
            this.currentZoom = this.zoomLevels[this.currentZoomIndex];
            
            this.zoomSubject.next({ zoom: this.currentZoom, index: this.currentZoomIndex });
        }
    }

    toggleZoom(): void {
        if (!this.camera) return;
        
        this.currentZoomIndex = (this.currentZoomIndex + 1) % this.zoomLevels.length;
        this.currentZoom = this.zoomLevels[this.currentZoomIndex];
        
        const targetCenter = this.camera.getTargetCenter();
        this.camera.setTarget(targetCenter, this.currentZoom);
        
        this.zoomSubject.next({ zoom: this.currentZoom, index: this.currentZoomIndex });
    }

    reset(): void {
        this.zoomLevels = [1.0, 2.0, 3.0, 4.0, 5.0];
        this.currentZoomIndex = 0;
        this.currentZoom = 1.0;
        this.camera = undefined;
        this.zoomSubject.next({ zoom: this.currentZoom, index: this.currentZoomIndex });
    }
}

