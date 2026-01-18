import { PhysicsConfiguration } from './physics-configuration';

describe('PhysicsConfiguration', () => {
  describe('FromJson', () => {
    it('should parse complete PhysicsConfiguration with PascalCase', () => {
      const physics = new PhysicsConfiguration();
      const json = {
        Mass: 100,
        Damping: 0.5,
        Restitution: 0.8,
        HasCollision: false,
        CanMove: true,
        HasGravity: false,
        CanRotate: true,
        CollisionBox: {
          minX: 0.1,
          minY: 0.2,
          maxX: 0.9,
          maxY: 0.8
        }
      };

      physics.FromJson(json);

      expect(physics.mass).toBe(100);
      expect(physics.damping).toBe(0.5);
      expect(physics.restitution).toBe(0.8);
      expect(physics.hasCollision).toBe(false);
      expect(physics.canMove).toBe(true);
      expect(physics.hasGravity).toBe(false);
      expect(physics.canRotate).toBe(true);
      expect(physics.collisionBox).toEqual({
        minX: 0.1,
        minY: 0.2,
        maxX: 0.9,
        maxY: 0.8
      });
    });

    it('should parse PhysicsConfiguration with camelCase', () => {
      const physics = new PhysicsConfiguration();
      const json = {
        mass: 200,
        damping: 0.3,
        restitution: 0.6,
        hasCollision: true,
        canMove: false,
        hasGravity: true,
        canRotate: false,
        collisionBox: {
          minX: 0.2,
          minY: 0.3,
          maxX: 0.8,
          maxY: 0.7
        }
      };

      physics.FromJson(json);

      expect(physics.mass).toBe(200);
      expect(physics.damping).toBe(0.3);
      expect(physics.restitution).toBe(0.6);
      expect(physics.hasCollision).toBe(true);
      expect(physics.canMove).toBe(false);
      expect(physics.hasGravity).toBe(true);
      expect(physics.canRotate).toBe(false);
    });

    it('should use defaults when fields are missing', () => {
      const physics = new PhysicsConfiguration();
      physics.FromJson({});

      expect(physics.mass).toBeUndefined();
      expect(physics.damping).toBeUndefined();
      expect(physics.restitution).toBeUndefined();
      expect(physics.hasCollision).toBe(true);
      expect(physics.canMove).toBe(true);
      expect(physics.hasGravity).toBe(true);
      expect(physics.canRotate).toBe(true);
      expect(physics.collisionBox).toBeUndefined();
    });

    it('should handle null/undefined input', () => {
      const physics = new PhysicsConfiguration();
      physics.hasCollision = false;

      physics.FromJson(null);
      expect(physics.hasCollision).toBe(false);

      physics.FromJson(undefined);
      expect(physics.hasCollision).toBe(false);
    });

    it('should convert string numbers to numbers', () => {
      const physics = new PhysicsConfiguration();
      const json = {
        mass: '150',
        damping: '0.4',
        restitution: '0.7'
      };

      physics.FromJson(json);

      expect(physics.mass).toBe(150);
      expect(physics.damping).toBe(0.4);
      expect(physics.restitution).toBe(0.7);
    });

    it('should convert boolean values correctly', () => {
      const physics = new PhysicsConfiguration();
      const json = {
        hasCollision: 1,
        canMove: 0,
        hasGravity: true,
        canRotate: false
      };

      physics.FromJson(json);

      expect(physics.hasCollision).toBe(true);
      expect(physics.canMove).toBe(false);
      expect(physics.hasGravity).toBe(true);
      expect(physics.canRotate).toBe(false);
    });

    it('should support backward-compatible boundingBox field', () => {
      const physics = new PhysicsConfiguration();
      const json = {
        boundingBox: {
          minX: 0.3,
          minY: 0.4,
          maxX: 0.7,
          maxY: 0.6
        }
      };

      physics.FromJson(json);

      expect(physics.collisionBox).toEqual({
        minX: 0.3,
        minY: 0.4,
        maxX: 0.7,
        maxY: 0.6
      });
    });

    it('should prefer collisionBox over boundingBox', () => {
      const physics = new PhysicsConfiguration();
      const json = {
        collisionBox: {
          minX: 0.1,
          minY: 0.2,
          maxX: 0.9,
          maxY: 0.8
        },
        boundingBox: {
          minX: 0.3,
          minY: 0.4,
          maxX: 0.7,
          maxY: 0.6
        }
      };

      physics.FromJson(json);

      expect(physics.collisionBox).toEqual({
        minX: 0.1,
        minY: 0.2,
        maxX: 0.9,
        maxY: 0.8
      });
    });

    it('should handle partial updates', () => {
      const physics = new PhysicsConfiguration();
      physics.mass = 100;
      physics.hasCollision = true;

      physics.FromJson({ damping: 0.5 });

      expect(physics.mass).toBe(100);
      expect(physics.damping).toBe(0.5);
      expect(physics.hasCollision).toBe(true);
    });
  });
});
