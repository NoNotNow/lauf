import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StartupService, MapLoader } from './startup.service';
import { PersistenceService } from './persistence.service';
import { Map as GameMap } from '../models/map';

describe('StartupService', () => {
  let service: StartupService;
  let persistenceService: PersistenceService;
  let httpMock: HttpTestingController;
  let mockLoader: jasmine.SpyObj<MapLoader>;

  beforeEach(() => {
    mockLoader = jasmine.createSpyObj<MapLoader>('MapLoader', ['loadMap']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StartupService, PersistenceService]
    });
    service = TestBed.inject(StartupService);
    persistenceService = TestBed.inject(PersistenceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('main', () => {
    it('should load map and call target.loadMap', (done) => {
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

      service.main(mockLoader, 'assets/maps/test.json');

      const req = httpMock.expectOne('assets/maps/test.json');
      req.flush(mockMapData);

      setTimeout(() => {
        expect(mockLoader.loadMap).toHaveBeenCalledTimes(1);
        const loadedMap = mockLoader.loadMap.calls.mostRecent().args[0];
        expect(loadedMap).toBeInstanceOf(GameMap);
        expect(loadedMap.name).toBe('Test Level');
        done();
      }, 0);
    });

    it('should use default URL when not provided', (done) => {
      const mockMapData = {
        Name: 'Default Map'
      };

      service.main(mockLoader);

      const req = httpMock.expectOne('assets/maps/test.json');
      req.flush(mockMapData);

      setTimeout(() => {
        expect(mockLoader.loadMap).toHaveBeenCalledTimes(1);
        done();
      }, 0);
    });

    it('should handle HTTP errors gracefully', (done) => {
      const consoleSpy = spyOn(console, 'error');

      service.main(mockLoader, 'assets/maps/notfound.json');

      const req = httpMock.expectOne('assets/maps/notfound.json');
      req.flush('404 Not Found', { status: 404, statusText: 'Not Found' });

      setTimeout(() => {
        expect(mockLoader.loadMap).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          'StartupService: Failed to load map',
          jasmine.any(Object)
        );
        done();
      }, 0);
    });

    it('should load map with all fields', (done) => {
      const mockMapData = {
        Name: 'Complete Map',
        Size: { X: 100, Y: 100 },
        Camera: {
          Position: { X: 10, Y: 10 },
          Zoom: 2.0,
          ZoomLevels: [1, 2, 3]
        },
        Design: {
          Color: '#ff0000'
        },
        Obstacles: [
          {
            Pose: {
              Position: { X: 20, Y: 20 },
              Size: { X: 1, Y: 1 }
            }
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
          }
        }
      };

      service.main(mockLoader, 'assets/maps/complete.json');

      const req = httpMock.expectOne('assets/maps/complete.json');
      req.flush(mockMapData);

      setTimeout(() => {
        expect(mockLoader.loadMap).toHaveBeenCalledTimes(1);
        const loadedMap = mockLoader.loadMap.calls.mostRecent().args[0];
        expect(loadedMap).toBeInstanceOf(GameMap);
        expect(loadedMap.name).toBe('Complete Map');
        expect(loadedMap.size.x).toBe(100);
        expect(loadedMap.obstacles.length).toBe(1);
        expect(loadedMap.targets.length).toBe(1);
        expect(loadedMap.avatar).toBeDefined();
        done();
      }, 0);
    });

    it('should handle empty map', (done) => {
      service.main(mockLoader, 'assets/maps/empty.json');

      const req = httpMock.expectOne('assets/maps/empty.json');
      req.flush({});

      setTimeout(() => {
        expect(mockLoader.loadMap).toHaveBeenCalledTimes(1);
        const loadedMap = mockLoader.loadMap.calls.mostRecent().args[0];
        expect(loadedMap).toBeInstanceOf(GameMap);
        done();
      }, 0);
    });
  });
});
