import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ChangeDetectorRef } from '@angular/core';
import { MapComponent } from './map.component';
import { StartupService, MapLoader } from '../../../../core/services/startup.service';
import { MapConfigurationService } from '../../../../core/services/map-configuration.service';
import { ZoomService } from '../../../../core/services/zoom.service';
import { FullscreenService } from '../../../../core/services/fullscreen.service';
import { RenderingCoordinatorService } from '../../../../core/services/rendering-coordinator.service';
import { WorldContextService } from '../../../../core/services/world-context.service';
import { AnimatorService } from '../../../../core/rendering/animator.service';
import { Map as GameMap } from '../../../../core/models/map';
import { Point } from '../../../../core/models/point';
import { Camera } from '../../../../core/rendering/camera';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;
  let startupService: jasmine.SpyObj<StartupService>;
  let mapConfigService: jasmine.SpyObj<MapConfigurationService>;
  let zoomService: jasmine.SpyObj<ZoomService>;
  let fullscreenService: jasmine.SpyObj<FullscreenService>;
  let renderingCoordinator: jasmine.SpyObj<RenderingCoordinatorService>;
  let worldContextService: jasmine.SpyObj<WorldContextService>;
  let animatorService: jasmine.SpyObj<AnimatorService>;

  beforeEach(async () => {
    const startupSpy = jasmine.createSpyObj('StartupService', ['main']);
    const mapConfigSpy = jasmine.createSpyObj('MapConfigurationService', ['loadMap'], {
      config: { /* mock config */ },
      config$: { subscribe: () => {} }
    });
    const zoomSpy = jasmine.createSpyObj('ZoomService', ['loadZoomLevelsFromMap', 'setCamera', 'getCurrentZoom', 'getCurrentZoomIndex', 'toggleZoom'], {
      getCurrentZoom: () => 1.0,
      getCurrentZoomIndex: () => 0
    });
    const fullscreenSpy = jasmine.createSpyObj('FullscreenService', ['handleTouchStart']);
    const renderingCoordinatorSpy = jasmine.createSpyObj('RenderingCoordinatorService', [
      'registerGridLayer',
      'registerObstaclesLayer',
      'registerAvatarsLayer',
      'unregisterLayer',
      'start',
      'stop',
      'setMap',
      'setCamera',
      'createObstaclesDrawCallback',
      'createAvatarsDrawCallback'
    ], {
      createObstaclesDrawCallback: () => () => {},
      createAvatarsDrawCallback: () => () => {}
    });
    const worldContextSpy = jasmine.createSpyObj('WorldContextService', [
      'setConfig',
      'buildWorld',
      'getCamera',
      'cleanup'
    ]);
    worldContextSpy.getCamera.and.returnValue(new Camera(new Point(5, 5), 1.0));
    const animatorSpy = jasmine.createSpyObj('AnimatorService', ['destroy']);

    await TestBed.configureTestingModule({
      imports: [MapComponent, HttpClientTestingModule],
      providers: [
        { provide: StartupService, useValue: startupSpy },
        { provide: MapConfigurationService, useValue: mapConfigSpy },
        { provide: ZoomService, useValue: zoomSpy },
        { provide: FullscreenService, useValue: fullscreenSpy },
        { provide: RenderingCoordinatorService, useValue: renderingCoordinatorSpy },
        { provide: WorldContextService, useValue: worldContextSpy },
        { provide: AnimatorService, useValue: animatorSpy },
        ChangeDetectorRef
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    startupService = TestBed.inject(StartupService) as jasmine.SpyObj<StartupService>;
    mapConfigService = TestBed.inject(MapConfigurationService) as jasmine.SpyObj<MapConfigurationService>;
    zoomService = TestBed.inject(ZoomService) as jasmine.SpyObj<ZoomService>;
    fullscreenService = TestBed.inject(FullscreenService) as jasmine.SpyObj<FullscreenService>;
    renderingCoordinator = TestBed.inject(RenderingCoordinatorService) as jasmine.SpyObj<RenderingCoordinatorService>;
    worldContextService = TestBed.inject(WorldContextService) as jasmine.SpyObj<WorldContextService>;
    animatorService = TestBed.inject(AnimatorService) as jasmine.SpyObj<AnimatorService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadMap', () => {
    it('should load complete map and configure all services', () => {
      const map = new GameMap();
      map.name = 'Test Level';
      map.size = new Point(100, 100);
      map.camera = new Camera(new Point(5, 5), 1.0);
      map.zoomLevels = [1, 2, 3];
      map.avatar = {} as any;
      map.obstacles = [];
      map.targets = [];

      component.loadMap(map);

      expect(mapConfigService.loadMap).toHaveBeenCalledWith(map);
      expect(zoomService.loadZoomLevelsFromMap).toHaveBeenCalledWith(map);
      expect(renderingCoordinator.setMap).toHaveBeenCalledWith(map);
      expect(worldContextService.setConfig).toHaveBeenCalledWith({ enableCollisions: true });
      expect(worldContextService.buildWorld).toHaveBeenCalledWith(map);
      expect(zoomService.setCamera).toHaveBeenCalled();
      expect(renderingCoordinator.setCamera).toHaveBeenCalled();
    });

    it('should handle null map gracefully', () => {
      component.loadMap(null as any);

      expect(mapConfigService.loadMap).not.toHaveBeenCalled();
      expect(zoomService.loadZoomLevelsFromMap).not.toHaveBeenCalled();
    });

    it('should handle map without camera', () => {
      const map = new GameMap();
      map.size = new Point(100, 100);
      map.avatar = {} as any;

      component.loadMap(map);

      expect(worldContextService.buildWorld).toHaveBeenCalledWith(map);
      expect(worldContextService.getCamera).toHaveBeenCalled();
    });

    it('should configure collisions based on enableItemCollisions', () => {
      const map = new GameMap();
      map.size = new Point(100, 100);

      component.enableItemCollisions = false;
      component.loadMap(map);

      expect(worldContextService.setConfig).toHaveBeenCalledWith({ enableCollisions: false });
    });

    it('should set camera on services when camera exists', () => {
      const map = new GameMap();
      map.size = new Point(100, 100);
      const camera = new Camera(new Point(10, 10), 2.0);
      worldContextService.getCamera.and.returnValue(camera);

      component.loadMap(map);

      expect(zoomService.setCamera).toHaveBeenCalledWith(camera);
      expect(renderingCoordinator.setCamera).toHaveBeenCalledWith(camera);
    });

    it('should not set camera on services when camera is undefined', () => {
      const map = new GameMap();
      map.size = new Point(100, 100);
      worldContextService.getCamera.and.returnValue(undefined);

      component.loadMap(map);

      // Camera-related calls should still happen but with undefined camera
      expect(worldContextService.buildWorld).toHaveBeenCalled();
    });

    it('should handle map with obstacles and targets', () => {
      const map = new GameMap();
      map.size = new Point(100, 100);
      map.obstacles = [{} as any, {} as any];
      map.targets = [{} as any];

      component.loadMap(map);

      expect(worldContextService.buildWorld).toHaveBeenCalledWith(map);
    });
  });

  describe('ngAfterViewInit', () => {
    it('should register layers and start coordinator', () => {
      // Mock ViewChild references
      component.grid = {} as any;
      component.animLayer = {} as any;
      component.avatarsCanvas = {} as any;

      component.ngAfterViewInit();

      expect(renderingCoordinator.registerGridLayer).toHaveBeenCalled();
      expect(renderingCoordinator.registerObstaclesLayer).toHaveBeenCalled();
      expect(renderingCoordinator.registerAvatarsLayer).toHaveBeenCalled();
      expect(renderingCoordinator.start).toHaveBeenCalled();
      expect(startupService.main).toHaveBeenCalledWith(component);
    });
  });

  describe('ngOnDestroy', () => {
    it('should cleanup resources', () => {
      component.grid = {} as any;
      component.animLayer = {} as any;
      component.avatarsCanvas = {} as any;

      component.ngOnDestroy();

      expect(renderingCoordinator.stop).toHaveBeenCalled();
      expect(renderingCoordinator.unregisterLayer).toHaveBeenCalledTimes(3);
      expect(worldContextService.cleanup).toHaveBeenCalled();
      expect(animatorService.destroy).toHaveBeenCalled();
    });
  });

  describe('toggleZoom', () => {
    it('should call zoomService.toggleZoom', () => {
      component.toggleZoom();
      expect(zoomService.toggleZoom).toHaveBeenCalled();
    });
  });

  describe('onTouchStart', () => {
    it('should call fullscreenService.handleTouchStart', () => {
      const event = new TouchEvent('touchstart');
      fullscreenService.handleTouchStart.and.returnValue(false);

      component.onTouchStart(event);

      expect(fullscreenService.handleTouchStart).toHaveBeenCalledWith(event);
    });

    it('should prevent default when fullscreen toggled', () => {
      const event = new TouchEvent('touchstart');
      const preventDefaultSpy = spyOn(event, 'preventDefault');
      fullscreenService.handleTouchStart.and.returnValue(true);

      component.onTouchStart(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});
