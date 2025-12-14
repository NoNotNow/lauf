import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { GridComponent } from '../../stage/grid/grid.component';
import { Point } from '../../../models/point';
import { ObstaclesComponent } from '../../stage/obstacles/obstacles.component';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [GridComponent, ObstaclesComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit {
  // Configure grid appearance
  gridColor = '#cccccc';
  gridLineWidth = 5; // in CSS pixels
  size: Point = new Point(10, 10);

  @ViewChild(ObstaclesComponent)
  obstacles!: ObstaclesComponent;

  ngAfterViewInit(): void {
    // Programmatically set an obstacle at grid position (1,1)
    this.obstacles?.setObstacle(new Point(1, 1), true);
  }
}
