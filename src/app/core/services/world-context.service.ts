import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Map as GameMap } from '../models/map';
import { WorldContext } from '../models/world-context';
import { WorldAssemblerService } from './world-assembler.service';
import { Camera } from '../rendering/camera';

export interface WorldContextConfig {
    enableCollisions: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorldContextService {
    private worldContext?: WorldContext;
    private config: WorldContextConfig = { enableCollisions: true };
    
    private contextSubject = new BehaviorSubject<WorldContext | undefined>(undefined);
    public readonly context$: Observable<WorldContext | undefined> = this.contextSubject.asObservable();

    constructor(private worldAssembler: WorldAssemblerService) {}

    getContext(): WorldContext | undefined {
        return this.worldContext;
    }

    getCamera(): Camera | undefined {
        return this.worldContext?.getCamera();
    }

    setConfig(config: Partial<WorldContextConfig>): void {
        this.config = { ...this.config, ...config };
    }

    buildWorld(map: GameMap): void {
        this.cleanup();
        this.worldContext = this.worldAssembler.buildWorld(map, this.config);
        this.worldContext.start();
        this.contextSubject.next(this.worldContext);
    }

    updateCamera(): void {
        this.worldContext?.updateCamera();
    }

    isCameraDirty(): boolean {
        return this.worldContext?.isCameraDirty() ?? false;
    }

    clearCameraDirty(): void {
        this.worldContext?.clearCameraDirty();
    }

    cleanup(): void {
        if (this.worldContext) {
            this.worldContext.cleanup();
            this.worldContext = undefined;
            this.contextSubject.next(undefined);
        }
    }
}

