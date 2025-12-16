// A small, composition-friendly image cache for rendering purposes
export class ImageCache {
  private _imageCache: Map<string, HTMLImageElement> = new Map();
  private _requested: Set<string> = new Set();

  constructor(private redrawEventName: string = 'app-canvas-redraw') {}

  get(url: string | undefined | null): HTMLImageElement | undefined {
    if (!url) return undefined;
    let img = this._imageCache.get(url);
    if (img) return img;
    img = new Image();
    img.src = url;
    if (!this._requested.has(url)) {
      this._requested.add(url);
      img.onload = () => {
        this._imageCache.set(url!, img!);
        try {
          window.dispatchEvent(new CustomEvent(this.redrawEventName));
        } catch {
          // ignore dispatch errors in non-browser contexts
        }
      };
      img.onerror = () => {
        try {
          window.dispatchEvent(new CustomEvent(this.redrawEventName));
        } catch {
          // ignore
        }
      };
    }
    return img;
  }
}
