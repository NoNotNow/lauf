export interface GridGeometry {
  // grid dimensions in cells
  cols: number;
  rows: number;

  // cell size in canvas pixels
  cellW: number;
  cellH: number;

  // Compute a rectangle in canvas pixels covering a block of cells
  // starting at (col,row), spanning wCells x hCells.
  // padRatio: 0..0.5 trims edges proportionally to the smallest cell dimension.
  rectForCells(
    col: number,
    row: number,
    wCells?: number,
    hCells?: number,
    padRatio?: number
  ): { x: number; y: number; w: number; h: number };
}
