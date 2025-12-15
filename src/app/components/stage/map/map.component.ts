import {AfterViewInit, Component, ViewChild} from '@angular/core';
import {GridComponent} from '../grid/grid.component';
import {Point} from '../../../models/point';
import {ObstaclesComponent} from '../obstacles/obstacles.component';
import {HtmlGameItemComponent} from '../html-game-item/html-game-item.component';
import {Map as GameMap} from '../../../models/map';
import {StartupService, MapLoader} from '../../../services/startup.service';

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [GridComponent, ObstaclesComponent, HtmlGameItemComponent],
    providers: [],
    templateUrl: './map.component.html',
    styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit, MapLoader {
    // Configure grid appearance
    gridColor = '#cccccc';
    gridLineWidth = 5; // in CSS pixels
    gridSize: Point = new Point(10, 10);

    @ViewChild(ObstaclesComponent)
    obstacles!: ObstaclesComponent;

    @ViewChild('targetsLayer')
    targets!: HtmlGameItemComponent;

    @ViewChild('avatarsLayer')
    avatars!: HtmlGameItemComponent;

    constructor(private startup: StartupService) {
    }

    ngAfterViewInit(): void {
        // Trigger startup to load and provide the Map to this component
        this.startup.main(this);
    }

    // Accepts a Map object and applies it to the grid, obstacles, and game items layers
    loadMap(m: GameMap): void {
        console.log('Loaded map:', m);
        if (!m) return;
        // Update grid size from map
        if (m.size) {
            this.gridSize = new Point(m.size.x, m.size.y);
        }

        // Pass obstacle objects directly to the obstacles layer
        if (this.obstacles) {
            this.obstacles.gridSize = this.gridSize;
            this.obstacles.items = m.obstacles || [];
        }

        // Load targets
        if (this.targets) {
            this.targets.items = m.targets || [];
        }

        // Load avatars
        if (this.avatars && m.avatars) {
            this.avatars.items = [m.avatars];
        }
    }
}
