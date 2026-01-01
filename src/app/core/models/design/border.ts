export class Border {
    public Color: string = '#000000';
    public Width: number = 0;
    public Style: string = 'none';
    public Active: boolean = true; // If false, grid is not drawn at all

    public FromJson(data: any): this {
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);
        if (g('Color','color') !== undefined) this.Color = g('Color','color');
        if (g('Width','width') !== undefined) this.Width = Number(g('Width','width'));
        if (g('Style','style') !== undefined) this.Style = g('Style','style');
        if (g('Active','active') !== undefined) this.Active = Boolean(g('Active','active'));
        return this;
    }
}