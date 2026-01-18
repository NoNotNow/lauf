import { Pose } from './pose';
import { Point } from './point';

describe('Pose', () => {
  describe('FromJson', () => {
    it('should parse complete Pose object with PascalCase', () => {
      const pose = new Pose();
      const json = {
        Position: { X: 10, Y: 20 },
        Size: { X: 5, Y: 6 },
        Rotation: 45
      };

      pose.FromJson(json);

      expect(pose.Position.x).toBe(10);
      expect(pose.Position.y).toBe(20);
      expect(pose.Size.x).toBe(5);
      expect(pose.Size.y).toBe(6);
      expect(pose.Rotation).toBe(45);
    });

    it('should parse Pose with camelCase', () => {
      const pose = new Pose();
      const json = {
        position: { x: 15, y: 25 },
        size: { x: 8, y: 9 },
        rotation: 90
      };

      pose.FromJson(json);

      expect(pose.Position.x).toBe(15);
      expect(pose.Position.y).toBe(25);
      expect(pose.Size.x).toBe(8);
      expect(pose.Size.y).toBe(9);
      expect(pose.Rotation).toBe(90);
    });

    it('should parse Position with mixed case (X/x, Y/y)', () => {
      const pose = new Pose();
      const json = {
        Position: { x: 30, Y: 40 }
      };

      pose.FromJson(json);

      expect(pose.Position.x).toBe(30);
      expect(pose.Position.y).toBe(40);
    });

    it('should parse Size with mixed case (X/x, Y/y)', () => {
      const pose = new Pose();
      const json = {
        Size: { X: 2, y: 3 }
      };

      pose.FromJson(json);

      expect(pose.Size.x).toBe(2);
      expect(pose.Size.y).toBe(3);
    });

    it('should use defaults when fields are missing', () => {
      const pose = new Pose();
      pose.FromJson({});

      expect(pose.Position.x).toBe(0);
      expect(pose.Position.y).toBe(0);
      expect(pose.Size.x).toBe(1);
      expect(pose.Size.y).toBe(1);
      expect(pose.Rotation).toBe(0);
    });

    it('should preserve existing values when fields are missing', () => {
      const pose = new Pose(new Point(100, 200), new Point(50, 60), 30);
      pose.FromJson({});

      expect(pose.Position.x).toBe(100);
      expect(pose.Position.y).toBe(200);
      expect(pose.Size.x).toBe(50);
      expect(pose.Size.y).toBe(60);
      expect(pose.Rotation).toBe(30);
    });

    it('should handle null/undefined input', () => {
      const pose = new Pose(new Point(1, 2), new Point(3, 4), 10);
      
      pose.FromJson(null);
      expect(pose.Position.x).toBe(1);
      expect(pose.Position.y).toBe(2);
      expect(pose.Size.x).toBe(3);
      expect(pose.Size.y).toBe(4);
      expect(pose.Rotation).toBe(10);

      pose.FromJson(undefined);
      expect(pose.Position.x).toBe(1);
    });

    it('should convert string numbers to numbers', () => {
      const pose = new Pose();
      const json = {
        Position: { X: '100', Y: '200' },
        Size: { X: '5', Y: '6' },
        Rotation: '45'
      };

      pose.FromJson(json);

      expect(pose.Position.x).toBe(100);
      expect(pose.Position.y).toBe(200);
      expect(pose.Size.x).toBe(5);
      expect(pose.Size.y).toBe(6);
      expect(pose.Rotation).toBe(45);
    });

    it('should handle partial Position updates', () => {
      const pose = new Pose(new Point(1, 2), new Point(3, 4), 5);
      pose.FromJson({ Position: { X: 10 } });

      expect(pose.Position.x).toBe(10);
      expect(pose.Position.y).toBe(2); // preserved
      expect(pose.Size.x).toBe(3);
      expect(pose.Size.y).toBe(4);
    });

    it('should handle partial Size updates', () => {
      const pose = new Pose(new Point(1, 2), new Point(3, 4), 5);
      pose.FromJson({ Size: { Y: 40 } });

      expect(pose.Size.x).toBe(3); // preserved
      expect(pose.Size.y).toBe(40);
    });
  });
});
