import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FullscreenService {
    private readonly DOUBLE_TAP_DELAY = 300; // ms
    private readonly DOUBLE_TAP_DISTANCE = 50; // pixels
    private lastTapTime: number = 0;
    private lastTapPosition: { x: number; y: number } | null = null;

    handleTouchStart(event: TouchEvent): boolean {
        // Returns true if fullscreen was toggled (to allow preventDefault)
        if (event.touches.length !== 1) return false;
        
        const touch = event.touches[0];
        const currentTime = Date.now();
        const currentPosition = { x: touch.clientX, y: touch.clientY };

        // Check if this is a double-tap
        if (this.lastTapTime > 0 && 
            (currentTime - this.lastTapTime) < this.DOUBLE_TAP_DELAY &&
            this.lastTapPosition &&
            Math.hypot(currentPosition.x - this.lastTapPosition.x, 
                      currentPosition.y - this.lastTapPosition.y) < this.DOUBLE_TAP_DISTANCE) {
            // Double-tap detected - toggle fullscreen
            this.toggleFullscreen();
            this.lastTapTime = 0; // Reset to prevent triple-tap
            this.lastTapPosition = null;
            return true;
        } else {
            // Store tap info for potential double-tap
            this.lastTapTime = currentTime;
            this.lastTapPosition = currentPosition;
            return false;
        }
    }

    toggleFullscreen(): void {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            const element = document.documentElement;
            if (element.requestFullscreen) {
                element.requestFullscreen().catch(err => {
                    console.error('Error attempting to enable fullscreen:', err);
                });
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    console.error('Error attempting to exit fullscreen:', err);
                });
            }
        }
    }
}

