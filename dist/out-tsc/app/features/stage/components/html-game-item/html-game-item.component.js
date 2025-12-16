var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Point } from '../../../../core/models/point';
let HtmlGameItemComponent = class HtmlGameItemComponent {
    constructor() {
        this.gridSize = new Point(10, 10); // x: cols, y: rows
        this.items = [];
        this.color = 'rgba(0,100,200,0.7)';
        this.items_display = [];
    }
    ngOnChanges(changes) {
        if (changes['items'] || changes['size']) {
            this.updateItemsDisplay();
        }
    }
    updateItemsDisplay() {
        const cols = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
        const rows = Math.max(1, Math.floor(this.gridSize?.y ?? 1));
        this.items_display = this.items.map((item, idx) => {
            const startX = Math.floor(item?.Pose.Position?.x ?? 0);
            const startY = Math.floor(item?.Pose.Position?.y ?? 0);
            const w = Math.max(1, Math.floor(item?.Pose.Size?.x ?? 1));
            const h = Math.max(1, Math.floor(item?.Pose.Size?.y ?? 1));
            // Calculate percentage-based positioning and sizing
            const left = (startX / cols) * 100;
            const top = (startY / rows) * 100;
            const width = (w / cols) * 100;
            const height = (h / rows) * 100;
            return {
                id: idx,
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                item: item
            };
        });
    }
};
__decorate([
    Input()
], HtmlGameItemComponent.prototype, "gridSize", void 0);
__decorate([
    Input()
], HtmlGameItemComponent.prototype, "items", void 0);
__decorate([
    Input()
], HtmlGameItemComponent.prototype, "color", void 0);
HtmlGameItemComponent = __decorate([
    Component({
        selector: 'app-html-game-item',
        standalone: true,
        imports: [CommonModule],
        templateUrl: './html-game-item.component.html',
        styleUrl: './html-game-item.component.scss'
    })
], HtmlGameItemComponent);
export { HtmlGameItemComponent };
//# sourceMappingURL=html-game-item.component.js.map