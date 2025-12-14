import { Component } from '@angular/core';
import { GridComponent } from '../../stage/grid/grid.component';

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
  gridLineWidth = 1; // in CSS pixels
}
