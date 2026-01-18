import { Map } from './map';
import { Point } from './point';
import { Design } from './design/design';
import { Camera } from '../rendering/camera';
import { Obstacle, Target, Avatar } from './game-items/stage-items';

describe('Map', () => {
  describe('FromJson', () => {
    it('should parse complete Map with PascalCase', () => {
      const map = new Map();
      const json = {
        Name: 'Test Level',
        Size: { X: 100, Y: 15 },
        Camera: {
          Position: { X: 5, Y: 5 },
          Zoom: 50,
          ZoomLevels: [5, 10, 15]
        },
        Design: {
          Color: '#118800'
        },
        Obstacles: [
          {
            Pose: {
              Position: { X: 10, Y: 10 },
              Size: { X: 1, Y: 1 }
            }
          }
        ],
        Targets: [
          {
            Pose: {
              Position: { X: 20, Y: 20 },
              Size: { X: 1, Y: 1 }
            }
          }
        ],
        Avatar: {
          Pose: {
            Position: { X: 1, Y: 5 },
            Size: { X: 0.26, Y: 0.36 }
          }
        }
      };

      map.FromJson(json);

      expect(map.name).toBe('Test Level');
      expect(map.size.x).toBe(100);
      expect(map.size.y).toBe(15);
      expect(map.camera).toBeInstanceOf(Camera);
      expect(map.design).toBeInstanceOf(Design);
      expect(map.obstacles.length).toBe(1);
      expect(map.targets.length).toBe(1);
      expect(map.avatar).toBeInstanceOf(Avatar);
    });

    it('should parse Map with camelCase', () => {
      const map = new Map();
      const json = {
        name: 'Test Level 2',
        size: { x: 50, y: 25 },
        camera: {
          position: { x: 10, y: 10 },
          zoom: 1.0
        }
      };

      map.FromJson(json);

      expect(map.name).toBe('Test Level 2');
      expect(map.size.x).toBe(50);
      expect(map.size.y).toBe(25);
      expect(map.camera).toBeInstanceOf(Camera);
    });

    it('should parse Camera with Center instead of Position', () => {
      const map = new Map();
      const json = {
        Camera: {
          Center: { X: 15, Y: 20 },
          Zoom: 2.0
        }
      };

      map.FromJson(json);

      expect(map.camera).toBeInstanceOf(Camera);
    });

    it('should parse Camera with center (camelCase)', () => {
      const map = new Map();
      const json = {
        camera: {
          center: { x: 25, y: 30 },
          zoom: 3.0
        }
      };

      map.FromJson(json);

      expect(map.camera).toBeInstanceOf(Camera);
    });

    it('should parse Size with mixed case (X/x, Y/y)', () => {
      const map = new Map();
      const json = {
        Size: { x: 100, Y: 200 }
      };

      map.FromJson(json);

      expect(map.size.x).toBe(100);
      expect(map.size.y).toBe(200);
    });

    it('should parse ZoomLevels array', () => {
      const map = new Map();
      const json = {
        Camera: {
          ZoomLevels: [5, 10.0, 15.0, 20.0, 30.0]
        }
      };

      map.FromJson(json);

      expect(map.zoomLevels).toEqual([5, 10.0, 15.0, 20.0, 30.0]);
    });

    it('should parse Avatar with Avatars field (backward compatibility)', () => {
      const map = new Map();
      const json = {
        Avatars: {
          Pose: {
            Position: { X: 1, Y: 5 }
          }
        }
      };

      map.FromJson(json);

      expect(map.avatar).toBeInstanceOf(Avatar);
    });

    it('should parse empty Obstacles array', () => {
      const map = new Map();
      const json = {
        Obstacles: []
      };

      map.FromJson(json);

      expect(map.obstacles).toEqual([]);
    });

    it('should parse empty Targets array', () => {
      const map = new Map();
      const json = {
        Targets: []
      };

      map.FromJson(json);

      expect(map.targets).toEqual([]);
    });

    it('should parse multiple Obstacles', () => {
      const map = new Map();
      const json = {
        Obstacles: [
          {
            Pose: { Position: { X: 10, Y: 10 } }
          },
          {
            Pose: { Position: { X: 20, Y: 20 } }
          },
          {
            Pose: { Position: { X: 30, Y: 30 } }
          }
        ]
      };

      map.FromJson(json);

      expect(map.obstacles.length).toBe(3);
      expect(map.obstacles[0]).toBeInstanceOf(Obstacle);
      expect(map.obstacles[1]).toBeInstanceOf(Obstacle);
      expect(map.obstacles[2]).toBeInstanceOf(Obstacle);
    });

    it('should parse multiple Targets', () => {
      const map = new Map();
      const json = {
        Targets: [
          {
            Pose: { Position: { X: 5, Y: 5 } }
          },
          {
            Pose: { Position: { X: 15, Y: 15 } }
          }
        ]
      };

      map.FromJson(json);

      expect(map.targets.length).toBe(2);
      expect(map.targets[0]).toBeInstanceOf(Target);
      expect(map.targets[1]).toBeInstanceOf(Target);
    });

    it('should handle null/undefined input', () => {
      const map = new Map();
      map.name = 'Original';

      map.FromJson(null);
      expect(map.name).toBe('Original');

      map.FromJson(undefined);
      expect(map.name).toBe('Original');
    });

    it('should use default Camera zoom when not specified', () => {
      const map = new Map();
      const json = {
        Camera: {
          Position: { X: 5, Y: 5 }
        }
      };

      map.FromJson(json);

      expect(map.camera).toBeInstanceOf(Camera);
    });

    it('should handle empty JSON object', () => {
      const map = new Map();
      map.FromJson({});

      expect(map.obstacles).toEqual([]);
      expect(map.targets).toEqual([]);
      expect(map.zoomLevels).toEqual([]);
    });

    it('should preserve array references when updating obstacles', () => {
      const map = new Map();
      const originalArray = map.obstacles;
      
      map.FromJson({
        Obstacles: [{ Pose: { Position: { X: 10, Y: 10 } } }]
      });

      expect(map.obstacles).toBe(originalArray);
      expect(map.obstacles.length).toBe(1);
    });

    it('should convert string numbers to numbers for ZoomLevels', () => {
      const map = new Map();
      const json = {
        Camera: {
          ZoomLevels: ['5', '10', '15']
        }
      };

      map.FromJson(json);

      expect(map.zoomLevels).toEqual([5, 10, 15]);
    });
  });
});
