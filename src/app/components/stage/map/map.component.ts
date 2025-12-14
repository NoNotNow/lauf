import { Component } from '@angular/core';
import { GridComponent } from '../../stage/grid/grid.component';
import { Point } from '../../../models/point';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [GridComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent {
  // Configure grid appearance
  gridColor = '#cccccc';
  gridLineWidth = 5; // in CSS pixels
  size: Point = new Point(10, 10);
}
