import { Border } from "./border";
import { BackgroundRepeat } from "./background-repeat";

export class Design {
    public Color: string = 'transparent';
    public Border: Border = new Border();
    public CornerRadius: number = 0;
    public Image: string = '';
    public Opacity: number = 1.0;
    public BackgroundRepeat: BackgroundRepeat = new BackgroundRepeat();

    // Fills current instance from a plain JSON/object without replacing it
    public FromJson(data: any): this {
        if (!data) return this;
        // accept both camelCase and PascalCase keys
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);
        if (g('Color', 'color') !== undefined) this.Color = g('Color', 'color');
        if (g('Border') !== undefined) {
            this.Border.FromJson(g('Border'));
        }
        if (g('CornerRadius','CornerRadius') !== undefined) this.CornerRadius = Number(g('CornerRadius','CornerRadius'));
        if (g('Image','image') !== undefined) this.Image = g('Image','image');
        if (g('Opacity', 'opacity') !== undefined) this.Opacity = Number(g('Opacity', 'opacity'));
        if (g('BackgroundRepeat', 'backgroundRepeat') !== undefined) {
            this.BackgroundRepeat.FromJson(g('BackgroundRepeat', 'backgroundRepeat'));
        }
        return this;
    }
}