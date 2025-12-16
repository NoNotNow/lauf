import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Map as GameMap } from '../models/map';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  constructor(private http: HttpClient) {}

  // Fetches a map JSON and returns a populated GameMap instance
  getMap(url: string = 'assets/examples/map.example.json'): Observable<GameMap> {
    return this.http.get(url).pipe(
      map((data: any) => new GameMap().FromJson(data))
    );
  }
}
