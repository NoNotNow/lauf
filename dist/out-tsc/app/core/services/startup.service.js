var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@angular/core';
let StartupService = class StartupService {
    constructor(persistence) {
        this.persistence = persistence;
    }
    // Triggers after load; fetches map and hands it to the target's loadMap
    main(target, url = 'assets/examples/map.example.json') {
        this.persistence.getMap(url).subscribe({
            next: (map) => target.loadMap(map),
            error: (err) => console.error('StartupService: Failed to load map', err)
        });
    }
};
StartupService = __decorate([
    Injectable({ providedIn: 'root' })
], StartupService);
export { StartupService };
//# sourceMappingURL=startup.service.js.map