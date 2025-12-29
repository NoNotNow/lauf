import { Injectable } from '@angular/core';
import { Map as GameMap } from '../models/map';
import { PersistenceService } from './persistence.service';

export interface MapLoader {
  loadMap(map: GameMap): void;
}

@Injectable({ providedIn: 'root' })
export class StartupService {
  constructor(private persistence: PersistenceService) {}

  // Triggers after load; fetches map and hands it to the target's loadMap
  main(target: MapLoader, url: string = 'assets/maps/testratio.json'): void {
    this.persistence.getMap(url).subscribe({
      next: (map) => target.loadMap(map),
      error: (err) => console.error('StartupService: Failed to load map', err)
    });
  }
}
