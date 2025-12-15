import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { GridComponent } from '../grid/grid.component';
import { Point } from '../../../models/point';
import { ObstaclesComponent } from '../obstacles/obstacles.component';
import { Map as GameMap } from '../../../models/map';
import { StartupService, MapLoader } from '../../../services/startup.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [GridComponent, ObstaclesComponent],
  providers: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit, MapLoader {
  // Configure grid appearance
  gridColor = '#cccccc';
  gridLineWidth = 5; // in CSS pixels
  size: Point = new Point(10, 10);

  @ViewChild(ObstaclesComponent)
  obstacles!: ObstaclesComponent;

  constructor(private startup: StartupService) {}

  ngAfterViewInit(): void {
    // Trigger startup to load and provide the Map to this component
    this.startup.main(this);
  }

  // Accepts a Map object and applies it to the grid and obstacles layer
  loadMap(m: GameMap): void {
    if (!m) return;
    // Update grid size from map
    if (m.size) {
      this.size = new Point(m.size.x, m.size.y);
    }

    // Clear existing and fill obstacles
    this.obstacles?.clearAll();
    for (const o of m.obstacles) {
      const startX = Math.floor(o?.Position?.x ?? 0);
      const startY = Math.floor(o?.Position?.y ?? 0);
      const w = Math.max(1, Math.floor(o?.Size?.x ?? 1));
      const h = Math.max(1, Math.floor(o?.Size?.y ?? 1));
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          this.obstacles?.setObstacle(new Point(startX + dx, startY + dy), true);
        }
      }
    }
  }
}
