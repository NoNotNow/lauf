import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PersistenceService } from './persistence.service';
import { Map as GameMap } from '../models/map';

describe('PersistenceService', () => {
  let service: PersistenceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PersistenceService]
    });
    service = TestBed.inject(PersistenceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getMap', () => {
    it('should fetch and parse map JSON', (done) => {
      const mockMapData = {
        Name: 'Test Level',
        Size: { X: 100, Y: 15 },
        Camera: {
          Position: { X: 5, Y: 5 },
          Zoom: 1.0
        },
        Obstacles: [],
        Targets: [],
        Avatar: {
          Pose: {
            Position: { X: 1, Y: 5 },
            Size: { X: 0.26, Y: 0.36 }
          }
        }
      };

      service.getMap('assets/maps/test.json').subscribe(map => {
        expect(map).toBeInstanceOf(GameMap);
        expect(map.name).toBe('Test Level');
        expect(map.size.x).toBe(100);
        expect(map.size.y).toBe(15);
        expect(map.obstacles).toEqual([]);
        expect(map.targets).toEqual([]);
        expect(map.avatar).toBeDefined();
        done();
      });

      const req = httpMock.expectOne('assets/maps/test.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockMapData);
    });

    it('should use default URL when not provided', (done) => {
      const mockMapData = {
        Name: 'Default Map'
      };

      service.getMap().subscribe(map => {
        expect(map).toBeInstanceOf(GameMap);
        expect(map.name).toBe('Default Map');
        done();
      });

      const req = httpMock.expectOne('assets/examples/example.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockMapData);
    });

    it('should handle map with minimal fields', (done) => {
      const mockMapData = {
        Name: 'Minimal Map'
      };

      service.getMap('assets/maps/minimal.json').subscribe(map => {
        expect(map).toBeInstanceOf(GameMap);
        expect(map.name).toBe('Minimal Map');
        expect(map.obstacles).toEqual([]);
        expect(map.targets).toEqual([]);
        done();
      });

      const req = httpMock.expectOne('assets/maps/minimal.json');
      req.flush(mockMapData);
    });

    it('should handle map with all fields', (done) => {
      const mockMapData = {
        Name: 'Complete Map',
        Size: { X: 100, Y: 100 },
        Camera: {
          Position: { X: 10, Y: 10 },
          Zoom: 2.0,
          ZoomLevels: [1, 2, 3]
        },
        Design: {
          Color: '#ff0000',
          Border: {
            Style: 'solid',
            Width: 1
          }
        },
        Obstacles: [
          {
            Pose: {
              Position: { X: 20, Y: 20 },
              Size: { X: 1, Y: 1 }
            },
            Transformers: [
              { Type: 'Rotator', Params: {} }
            ]
          }
        ],
        Targets: [
          {
            Pose: {
              Position: { X: 30, Y: 30 },
              Size: { X: 1, Y: 1 }
            }
          }
        ],
        Avatar: {
          Pose: {
            Position: { X: 5, Y: 5 },
            Size: { X: 1, Y: 1 }
          },
          Transformers: [
            { Type: 'UserController', Params: { maxSpeed: 4.0 } }
          ]
        }
      };

      service.getMap('assets/maps/complete.json').subscribe(map => {
        expect(map).toBeInstanceOf(GameMap);
        expect(map.name).toBe('Complete Map');
        expect(map.size.x).toBe(100);
        expect(map.obstacles.length).toBe(1);
        expect(map.targets.length).toBe(1);
        expect(map.avatar).toBeDefined();
        expect(map.zoomLevels).toEqual([1, 2, 3]);
        done();
      });

      const req = httpMock.expectOne('assets/maps/complete.json');
      req.flush(mockMapData);
    });

    it('should handle HTTP errors', (done) => {
      const errorMessage = '404 Not Found';

      service.getMap('assets/maps/notfound.json').subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error).toBeDefined();
          done();
        }
      });

      const req = httpMock.expectOne('assets/maps/notfound.json');
      req.flush(errorMessage, { status: 404, statusText: 'Not Found' });
    });

    it('should handle empty JSON object', (done) => {
      service.getMap('assets/maps/empty.json').subscribe(map => {
        expect(map).toBeInstanceOf(GameMap);
        expect(map.obstacles).toEqual([]);
        expect(map.targets).toEqual([]);
        done();
      });

      const req = httpMock.expectOne('assets/maps/empty.json');
      req.flush({});
    });
  });
});
