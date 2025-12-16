export class Design {
    // Fills current instance from a plain JSON/object without replacing it
    FromJson(data) {
        if (!data)
            return this;
        // accept both camelCase and PascalCase keys
        const g = (k, alt) => data[k] ?? (alt ? data[alt] : undefined);
        if (g('Color', 'color') !== undefined)
            this.Color = g('Color', 'color');
        if (g('Border', 'border') !== undefined)
            this.Border = g('Border', 'border');
        if (g('BorderColor', 'borderColor') !== undefined)
            this.BorderColor = g('BorderColor', 'borderColor');
        if (g('BorderWidth', 'borderWidth') !== undefined)
            this.BorderWidth = Number(g('BorderWidth', 'borderWidth'));
        if (g('BorderRadius', 'borderRadius') !== undefined)
            this.BorderRadius = Number(g('BorderRadius', 'borderRadius'));
        if (g('Image', 'image') !== undefined)
            this.Image = g('Image', 'image');
        return this;
    }
}
//# sourceMappingURL=design.js.map