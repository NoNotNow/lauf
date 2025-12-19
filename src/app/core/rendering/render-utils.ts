
/**
 * Helper to build a rounded-rectangle path on a CanvasRenderingContext2D.
 */
export function pathRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
): void {
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    if (r <= 0) {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}

/**
 * Applies a dashed line style to the context if requested.
 */
export function applyDashStyle(
    ctx: CanvasRenderingContext2D,
    style: string,
    width: number
): void {
    if (style.toLowerCase() === 'dashed') {
        const dash = Math.max(2, width * 2);
        const gap = Math.max(2, Math.round(width * 1.5));
        ctx.setLineDash([dash, gap]);
    } else {
        ctx.setLineDash([]);
    }
}
