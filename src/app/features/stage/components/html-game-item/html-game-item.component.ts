import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Point } from '../../../../core/models/point';
import { StageItem } from '../../../../core/models/game-items/stage-item';

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

  items_display: ItemDisplay[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] || changes['size']) {
      this.updateItemsDisplay();
    }
  }

  private updateItemsDisplay(): void {
    const cols = Math.max(1, Math.floor(this.gridSize?.x ?? 1));
    const rows = Math.max(1, Math.floor(this.gridSize?.y ?? 1));

    this.items_display = this.items.map((item, idx) => {
      const startX = Math.floor(item?.Position?.x ?? 0);
      const startY = Math.floor(item?.Position?.y ?? 0);
      const w = Math.max(1, Math.floor(item?.Size?.x ?? 1));
      const h = Math.max(1, Math.floor(item?.Size?.y ?? 1));

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

