import { StageItem } from './stage-item';
import { Pose } from '../pose';
import { Design } from '../design/design';
import { PhysicsConfiguration } from './physics-configuration';

describe('StageItem', () => {
  describe('FromJson', () => {
    it('should parse complete StageItem with PascalCase', () => {
      const item = new StageItem();
      const json = {
        Pose: {
          Position: { X: 10, Y: 20 },
          Size: { X: 5, Y: 6 },
          Rotation: 45
        },
        Design: {
          Color: '#ff0000',
          CornerRadius: 5
        },
        PhysicsConfiguration: {
          mass: 100,
          hasCollision: true
        },
        Transformers: [
          {
            Type: 'UserController',
            Params: { maxSpeed: 4.0 }
          },
          {
            Type: 'Rotator',
            Params: {}
          }
        ]
      };

      item.FromJson(json);

      expect(item.Pose.Position.x).toBe(10);
      expect(item.Pose.Position.y).toBe(20);
      expect(item.Design.Color).toBe('#ff0000');
      expect(item.Physics.mass).toBe(100);
      expect(item.Physics.hasCollision).toBe(true);
      expect(item.transformers.length).toBe(2);
      expect(item.transformers[0].Type).toBe('UserController');
      expect(item.transformers[0].Params).toEqual({ maxSpeed: 4.0 });
    });

    it('should parse StageItem with camelCase', () => {
      const item = new StageItem();
      const json = {
        pose: {
          position: { x: 15, y: 25 },
          size: { x: 8, y: 9 }
        },
        design: {
          color: '#00ff00'
        },
        physicsConfiguration: {
          mass: 200
        },
        transformers: [
          {
            type: 'Glider',
            params: { horizontalSpeed: 3.0 }
          }
        ]
      };

      item.FromJson(json);

      expect(item.Pose.Position.x).toBe(15);
      expect(item.Design.Color).toBe('#00ff00');
      expect(item.Physics.mass).toBe(200);
      expect(item.transformers.length).toBe(1);
      expect(item.transformers[0].Type).toBe('Glider');
    });

    it('should accept Position/Size at root level for backward compatibility', () => {
      const item = new StageItem();
      const json = {
        Position: { X: 30, Y: 40 },
        Size: { X: 10, Y: 20 },
        Rotation: 90
      };

      item.FromJson(json);

      expect(item.Pose.Position.x).toBe(30);
      expect(item.Pose.Position.y).toBe(40);
      expect(item.Pose.Size.x).toBe(10);
      expect(item.Pose.Size.y).toBe(20);
      expect(item.Pose.Rotation).toBe(90);
    });

    it('should parse Physics with both naming conventions', () => {
      const item = new StageItem();
      
      // Test PhysicsConfiguration
      item.FromJson({
        PhysicsConfiguration: { mass: 100 }
      });
      expect(item.Physics.mass).toBe(100);

      // Test Physics (alternative)
      item.FromJson({
        Physics: { mass: 200 }
      });
      expect(item.Physics.mass).toBe(200);

      // Test physicsConfiguration (camelCase)
      item.FromJson({
        physicsConfiguration: { mass: 300 }
      });
      expect(item.Physics.mass).toBe(300);
    });

    it('should parse restitution at root level', () => {
      const item = new StageItem();
      const json = {
        restitution: 0.5
      };

      item.FromJson(json);

      expect(item.Physics.restitution).toBe(0.5);
    });

    it('should parse Transformers array', () => {
      const item = new StageItem();
      const json = {
        Transformers: [
          { Type: 'UserController', Params: { maxSpeed: 4.0 } },
          { type: 'Rotator', params: { speed: 10 } },
          { Type: 'Glider', Params: null },
          { Type: 'UnknownType' }
        ]
      };

      item.FromJson(json);

      expect(item.transformers.length).toBe(4);
      expect(item.transformers[0].Type).toBe('UserController');
      expect(item.transformers[0].Params).toEqual({ maxSpeed: 4.0 });
      expect(item.transformers[1].Type).toBe('Rotator');
      expect(item.transformers[1].Params).toEqual({ speed: 10 });
      expect(item.transformers[2].Type).toBe('Glider');
      expect(item.transformers[3].Type).toBe('UnknownType');
    });

    it('should handle transformer without Params', () => {
      const item = new StageItem();
      const json = {
        Transformers: [
          { Type: 'Rotator' }
        ]
      };

      item.FromJson(json);

      expect(item.transformers.length).toBe(1);
      expect(item.transformers[0].Type).toBe('Rotator');
      expect(item.transformers[0].Params).toEqual({ Type: 'Rotator' });
    });

    it('should handle transformer with missing Type', () => {
      const item = new StageItem();
      const json = {
        Transformers: [
          { Params: { x: 1 } }
        ]
      };

      item.FromJson(json);

      expect(item.transformers.length).toBe(1);
      expect(item.transformers[0].Type).toBe('Unknown');
    });

    it('should use defaults when fields are missing', () => {
      const item = new StageItem();
      item.FromJson({});

      expect(item.Pose).toBeInstanceOf(Pose);
      expect(item.Design).toBeInstanceOf(Design);
      expect(item.Physics).toBeInstanceOf(PhysicsConfiguration);
      expect(item.transformers).toEqual([]);
    });

    it('should handle null/undefined input', () => {
      const item = new StageItem();
      item.Physics.mass = 100;

      item.FromJson(null);
      expect(item.Physics.mass).toBe(100);

      item.FromJson(undefined);
      expect(item.Physics.mass).toBe(100);
    });

    it('should handle empty Transformers array', () => {
      const item = new StageItem();
      const json = {
        Transformers: []
      };

      item.FromJson(json);

      expect(item.transformers).toEqual([]);
    });

    it('should handle transformer object without Type or Params keys', () => {
      const item = new StageItem();
      const json = {
        Transformers: [
          { horizontalSpeed: 3.0 }
        ]
      };

      item.FromJson(json);

      expect(item.transformers.length).toBe(1);
      expect(item.transformers[0].Type).toBe('Unknown');
      expect(item.transformers[0].Params).toEqual({ horizontalSpeed: 3.0 });
    });
  });
});
