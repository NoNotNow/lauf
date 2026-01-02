import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Map as GameMap } from '../models/map';
import { Point } from '../models/point';

export interface GridConfiguration {
    gridColor: string;
    gridLineWidth: number;
    gridSize: Point;
    gridBorder: string;
    gridBorderActive: boolean;
    gridBackgroundColor: string;
    gridBackgroundImage: string;
    gridBackgroundRepeat: { Mode: string, TileSize: { X: number, Y: number } } | null;
}

@Injectable({ providedIn: 'root' })
export class MapConfigurationService {
    private defaultConfig: GridConfiguration = {
        gridColor: '#cccccc',
        gridLineWidth: 0.01,
        gridSize: new Point(10, 10),
        gridBorder: 'solid',
        gridBorderActive: true,
        gridBackgroundColor: 'transparent',
        gridBackgroundImage: '',
        gridBackgroundRepeat: null
    };

    private configSubject = new BehaviorSubject<GridConfiguration>(this.defaultConfig);
    public readonly config$: Observable<GridConfiguration> = this.configSubject.asObservable();

    get config(): GridConfiguration {
        return this.configSubject.value;
    }

    loadMap(map: GameMap): void {
        if (!map) return;

        const newConfig = { ...this.config };
        
        // Update grid size
        if (map.size) {
            newConfig.gridSize = new Point(map.size.x, map.size.y);
        }

        // Apply design configuration
        if (map.design) {
            const { Border, Color, Image, BackgroundRepeat } = map.design;

            if (Border.Width !== undefined) newConfig.gridLineWidth = Border.Width;
            if (Border.Color) newConfig.gridColor = Border.Color;
            if (Border.Style) newConfig.gridBorder = Border.Style;
            if (Border.Active !== undefined) newConfig.gridBorderActive = Border.Active;
            if (Color) newConfig.gridBackgroundColor = Color;
            if (Image) newConfig.gridBackgroundImage = Image;
            
            if (BackgroundRepeat && BackgroundRepeat.Mode) {
                newConfig.gridBackgroundRepeat = {
                    Mode: BackgroundRepeat.Mode,
                    TileSize: {
                        X: BackgroundRepeat.TileSize?.X ?? 1,
                        Y: BackgroundRepeat.TileSize?.Y ?? 1
                    }
                };
            } else {
                newConfig.gridBackgroundRepeat = null;
            }
        }

        this.configSubject.next(newConfig);
    }

    reset(): void {
        this.configSubject.next({ ...this.defaultConfig });
    }
}

