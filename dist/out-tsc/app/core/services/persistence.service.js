var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { Map as GameMap } from '../models/map';
let PersistenceService = class PersistenceService {
    constructor(http) {
        this.http = http;
    }
    // Fetches a map JSON and returns a populated GameMap instance
    getMap(url = 'assets/examples/map.example.json') {
        return this.http.get(url).pipe(map((data) => new GameMap().FromJson(data)));
    }
};
PersistenceService = __decorate([
    Injectable({ providedIn: 'root' })
], PersistenceService);
export { PersistenceService };
//# sourceMappingURL=persistence.service.js.map