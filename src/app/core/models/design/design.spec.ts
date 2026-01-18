import { Design } from './design';
import { Border } from './border';
import { BackgroundRepeat } from './background-repeat';

describe('Design', () => {
  describe('FromJson', () => {
    it('should parse complete Design object with PascalCase', () => {
      const design = new Design();
      const json = {
        Color: '#ff0000',
        Border: {
          Style: 'solid',
          Color: '#000000',
          Width: 2
        },
        CornerRadius: 5,
        Image: 'assets/test.svg',
        Opacity: 0.8,
        BackgroundRepeat: {
          Mode: 'repeat-x',
          TileSize: { X: 10, Y: 20 }
        }
      };

      design.FromJson(json);

      expect(design.Color).toBe('#ff0000');
      expect(design.CornerRadius).toBe(5);
      expect(design.Image).toBe('assets/test.svg');
      expect(design.Opacity).toBe(0.8);
      expect(design.Border.Style).toBe('solid');
      expect(design.BackgroundRepeat.Mode).toBe('repeat-x');
    });

    it('should parse Design with camelCase', () => {
      const design = new Design();
      const json = {
        color: '#00ff00',
        cornerRadius: 3,
        image: 'assets/image.svg',
        opacity: 0.5
      };

      design.FromJson(json);

      expect(design.Color).toBe('#00ff00');
      expect(design.CornerRadius).toBe(3);
      expect(design.Image).toBe('assets/image.svg');
      expect(design.Opacity).toBe(0.5);
    });

    it('should use defaults when fields are missing', () => {
      const design = new Design();
      design.FromJson({});

      expect(design.Color).toBe('transparent');
      expect(design.CornerRadius).toBe(0);
      expect(design.Image).toBe('');
      expect(design.Opacity).toBe(1.0);
      expect(design.Border).toBeInstanceOf(Border);
      expect(design.BackgroundRepeat).toBeInstanceOf(BackgroundRepeat);
    });

    it('should parse nested Border object', () => {
      const design = new Design();
      const json = {
        Border: {
          Style: 'dashed',
          Color: '#123456',
          Width: 1.5,
          Active: false
        }
      };

      design.FromJson(json);

      expect(design.Border.Style).toBe('dashed');
      expect(design.Border.Color).toBe('#123456');
      expect(design.Border.Width).toBe(1.5);
      expect(design.Border.Active).toBe(false);
    });

    it('should parse nested BackgroundRepeat object', () => {
      const design = new Design();
      const json = {
        BackgroundRepeat: {
          Mode: 'repeat-y',
          TileSize: { X: 15, Y: 25 }
        }
      };

      design.FromJson(json);

      expect(design.BackgroundRepeat.Mode).toBe('repeat-y');
      expect(design.BackgroundRepeat.TileSize.X).toBe(15);
      expect(design.BackgroundRepeat.TileSize.Y).toBe(25);
    });

    it('should handle null/undefined input', () => {
      const design = new Design();
      design.Color = '#test';
      
      design.FromJson(null);
      expect(design.Color).toBe('#test');

      design.FromJson(undefined);
      expect(design.Color).toBe('#test');
    });

    it('should convert CornerRadius and Opacity to numbers', () => {
      const design = new Design();
      const json = {
        CornerRadius: '5',
        Opacity: '0.75'
      };

      design.FromJson(json);

      expect(design.CornerRadius).toBe(5);
      expect(design.Opacity).toBe(0.75);
    });

    it('should handle partial updates', () => {
      const design = new Design();
      design.Color = '#original';
      design.CornerRadius = 10;

      design.FromJson({ Image: 'new-image.svg' });

      expect(design.Color).toBe('#original');
      expect(design.CornerRadius).toBe(10);
      expect(design.Image).toBe('new-image.svg');
    });

    it('should handle empty string Color', () => {
      const design = new Design();
      design.FromJson({ Color: '' });

      expect(design.Color).toBe('');
    });
  });
});
