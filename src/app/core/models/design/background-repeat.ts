export class BackgroundRepeat {
    public Mode: string = 'no-repeat'; // 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'
    public TileSize: { X: number, Y: number } = { X: 1, Y: 1 }; // Size in grid cells

    public FromJson(data: any): this {
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);
        if (g('Mode', 'mode') !== undefined) this.Mode = g('Mode', 'mode');
        const ts = g('TileSize', 'tileSize');
        if (ts) {
            if (ts.X !== undefined || ts.x !== undefined) this.TileSize.X = Number(ts.X ?? ts.x ?? 1);
            if (ts.Y !== undefined || ts.y !== undefined) this.TileSize.Y = Number(ts.Y ?? ts.y ?? 1);
        }
        return this;
    }
}

