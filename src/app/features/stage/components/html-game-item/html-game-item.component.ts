import { Component, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Point } from '../../../../core/models/point';
import { StageItem } from '../../../../core/models/game-items/stage-item';
import { Camera } from '../../../../core/rendering/camera';

interface ItemDisplay {
  id: number;
  left: string;
  top: string;
  width: string;
  height: string;
  item: StageItem;
}

@Component({
  selector: 'app-html-game-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './html-game-item.component.html',
  styleUrl: './html-game-item.component.scss'
})
export class HtmlGameItemComponent implements OnChanges {
  @Input() gridSize: Point = new Point(10, 10); // x: cols, y: rows
  @Input() items: StageItem[] = [];
  @Input() color: string = 'rgba(0,100,200,0.7)';
  @Input() camera?: Camera;

  items_display: ItemDisplay[] = [];

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] || changes['gridSize'] || changes['camera']) {
      this.updateItemsDisplay();
    }
  }

  requestUpdate(): void {
    this.updateItemsDisplay();
  }

  private updateItemsDisplay(): void {
    if (!this.camera) {
        this.updateItemsDisplayLegacy();
        return;
    }

    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const dummyWidth = hostRect.width || 100;
    const dummyHeight = hostRect.height || 100;
    const baseGeom = {
        cols: this.gridSize.x,
        rows: this.gridSize.y,
        cellW: dummyWidth / this.gridSize.x,
        cellH: dummyHeight / this.gridSize.y,
        rectForCells: (col: number, row: number, wCells: number = 1, hCells: number = 1) => ({
            x: col * (dummyWidth / this.gridSize.x),
            y: row * (dummyHeight / this.gridSize.y),
            w: wCells * (dummyWidth / this.gridSize.x),
            h: hCells * (dummyHeight / this.gridSize.y)
        })
    };

    const transformedGeom = this.camera.transformGeometry(baseGeom as any, dummyWidth, dummyHeight);

    this.items_display = this.items.map((item, idx) => {
      const startX = item?.Pose.Position?.x ?? 0;
      const startY = item?.Pose.Position?.y ?? 0;
      const wCells = item?.Pose.Size?.x ?? 1;
      const hCells = item?.Pose.Size?.y ?? 1;

      const rect = transformedGeom.rectForCells(startX, startY, wCells, hCells);

      return {
        id: idx,
        left: `${(rect.x / dummyWidth) * 100}%`,
        top: `${(rect.y / dummyHeight) * 100}%`,
        width: `${(rect.w / dummyWidth) * 100}%`,
        height: `${(rect.h / dummyHeight) * 100}%`,
        item: item
      };
    });
  }

  private updateItemsDisplayLegacy(): void {
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
}

