var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Component, ViewChild } from '@angular/core';
import { GridComponent } from '../grid/grid.component';
import { Point } from '../../../../core/models/point';
import { ObstaclesComponent } from '../obstacles/obstacles.component';
import { HtmlGameItemComponent } from '../html-game-item/html-game-item.component';
let MapComponent = class MapComponent {
    constructor(startup) {
        this.startup = startup;
        // Configure grid appearance
        this.gridColor = '#cccccc';
        this.gridLineWidth = 0.01; // in cell units (1.0 == one cell)
        this.gridSize = new Point(10, 10);
    }
    ngAfterViewInit() {
        // Trigger startup to load and provide the Map to this component
        this.startup.main(this);
    }
    // Accepts a Map object and applies it to the grid, obstacles, and game items layers
    loadMap(m) {
        console.log('Loaded map:', m);
        if (!m)
            return;
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
};
__decorate([
    ViewChild(ObstaclesComponent)
], MapComponent.prototype, "obstacles", void 0);
__decorate([
    ViewChild('targetsLayer')
], MapComponent.prototype, "targets", void 0);
__decorate([
    ViewChild('avatarsLayer')
], MapComponent.prototype, "avatars", void 0);
MapComponent = __decorate([
    Component({
        selector: 'app-map',
        standalone: true,
        imports: [GridComponent, ObstaclesComponent, HtmlGameItemComponent],
        providers: [],
        templateUrl: './map.component.html',
        styleUrl: './map.component.scss'
    })
], MapComponent);
export { MapComponent };
//# sourceMappingURL=map.component.js.map