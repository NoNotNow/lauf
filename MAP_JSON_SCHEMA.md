# Map JSON Schema Documentation

This document describes the JSON schema for map files used by the game engine. Map files define the game world including obstacles, targets, avatar, camera settings, and visual design.

## Root Level Properties

### `Name` / `name` (optional)
- **Type**: `string`
- **Description**: Display name of the map
- **Example**: `"Sample Level 1"`

### `Size` / `size` (optional)
- **Type**: `object`
- **Description**: Map dimensions in grid cells
- **Properties**:
  - `X` / `x` (optional): Width in grid cells
  - `Y` / `y` (optional): Height in grid cells
- **Default**: `{ x: 0, y: 0 }`
- **Example**:
  ```json
  {
    "X": 100,
    "Y": 15
  }
  ```

### `Camera` / `camera` (optional)
- **Type**: `object`
- **Description**: Camera configuration
- **Properties**:
  - `Position` / `position` / `Center` / `center` (optional): Initial camera position
    - `X` / `x`: X coordinate
    - `Y` / `y`: Y coordinate
  - `Zoom` / `zoom` (optional): Initial zoom level. **Default**: `1.0`
  - `ZoomLevels` / `zoomLevels` (optional): Array of available zoom levels. **Default**: `[]`
- **Example**:
  ```json
  {
    "Position": { "X": 5, "Y": 5 },
    "Zoom": 50,
    "ZoomLevels": [5, 10.0, 15.0, 20.0, 30.0, 50.0, 75]
  }
  ```

### `Design` / `design` (optional)
- **Type**: `object`
- **Description**: Map background design
- **See**: [Design Object](#design-object) for details

### `Obstacles` / `obstacles` (optional)
- **Type**: `array` of [StageItem](#stageitem-object) objects
- **Description**: List of obstacles in the map
- **Default**: `[]`

### `Targets` / `targets` (optional)
- **Type**: `array` of [StageItem](#stageitem-object) objects
- **Description**: List of targets in the map
- **Default**: `[]`

### `Avatar` / `avatar` / `Avatars` / `avatars` (optional)
- **Type**: [StageItem](#stageitem-object) object
- **Description**: Player avatar configuration

## Design Object

Represents visual design properties for map background or stage items.

### Properties

- `Color` / `color` (optional): Background color. **Default**: `"transparent"`
- `Border` / `border` (optional): Border configuration. **See**: [Border Object](#border-object)
- `CornerRadius` / `cornerRadius` (optional): Corner radius. **Default**: `0`
- `Image` / `image` (optional): Image path. **Default**: `""`
- `Opacity` / `opacity` (optional): Opacity (0.0-1.0). **Default**: `1.0`
- `BackgroundRepeat` / `backgroundRepeat` (optional): Background repeat configuration. **See**: [BackgroundRepeat Object](#backgroundrepeat-object)

### Example
```json
{
  "Color": "#118800",
  "Border": {
    "Style": "dashed",
    "Color": "#FFFFFF11",
    "Width": 0.002
  },
  "Image": "assets/game/backgrounds/evening-stars.svg",
  "Opacity": 1.0,
  "BackgroundRepeat": {
    "Mode": "x-repeat",
    "TileSize": { "X": 20, "Y": 15 }
  }
}
```

## Border Object

Represents border styling.

### Properties

- `Color` / `color` (optional): Border color. **Default**: `"#000000"`
- `Width` / `width` (optional): Border width. **Default**: `0`
- `Style` / `style` (optional): Border style. Valid values: `"none"`, `"solid"`, `"dashed"`, `"dotted"`. **Default**: `"none"`
- `Active` / `active` (optional): Whether border is active. **Default**: `true`

### Example
```json
{
  "Style": "dashed",
  "Color": "#ff9900",
  "Width": 0.01,
  "Active": true
}
```

## BackgroundRepeat Object

Represents background image repeat configuration.

### Properties

- `Mode` / `mode` (optional): Repeat mode. Valid values: `"repeat"`, `"repeat-x"`, `"repeat-y"`, `"no-repeat"`. **Default**: `"no-repeat"`
- `TileSize` / `tileSize` (optional): Tile size in grid cells. **Default**: `{ X: 1, Y: 1 }`
  - `X` / `x`: Tile width
  - `Y` / `y`: Tile height

### Example
```json
{
  "Mode": "x-repeat",
  "TileSize": { "X": 20, "Y": 15 }
}
```

## StageItem Object

Represents an obstacle, target, or avatar with position, design, physics, and behaviors.

### Properties

- `Id` / `id` (optional): Unique identifier for the item
- `Pose` / `pose` (optional): Position, size, and rotation. **See**: [Pose Object](#pose-object)
- `Design` / `design` (optional): Visual design. **See**: [Design Object](#design-object)
- `Physics` / `physics` / `PhysicsConfiguration` / `physicsConfiguration` (optional): Physics configuration. **See**: [PhysicsConfiguration Object](#physicsconfiguration-object)
- `restitution` / `Restitution` (optional): Shortcut to set Physics.restitution
- `Transformers` / `transformers` (optional): Array of [Transformer](#transformer-object) objects. **Default**: `[]`

### Note on Pose
If `Pose` is not present, the root-level `Position`, `Size`, and `Rotation` properties are also accepted for backward compatibility.

### Example
```json
{
  "Id": "Avatar",
  "Pose": {
    "Position": { "X": 1, "Y": 5 },
    "Size": { "X": 0.26, "Y": 0.36 },
    "Rotation": 0
  },
  "Design": {
    "Color": "transparent",
    "Image": "assets/game/rocket.svg"
  },
  "Physics": {
    "mass": 200,
    "canMove": true,
    "hasGravity": true
  },
  "Transformers": [
    {
      "Type": "FlightKeyboardController",
      "Params": { "maxSpeed": 4.0 }
    }
  ]
}
```

## Pose Object

Represents position, size, and rotation of a stage item.

### Properties

- `Position` / `position` (optional): Position coordinates. **Default**: `{ x: 0, y: 0 }`
  - `X` / `x`: X coordinate
  - `Y` / `y`: Y coordinate
- `Size` / `size` (optional): Size dimensions. **Default**: `{ x: 1, y: 1 }`
  - `X` / `x`: Width
  - `Y` / `y`: Height
- `Rotation` / `rotation` (optional): Rotation in degrees. **Default**: `0`

### Example
```json
{
  "Position": { "X": 10, "Y": 5 },
  "Size": { "X": 0.8, "Y": 0.8 },
  "Rotation": 45
}
```

## PhysicsConfiguration Object

Represents physics properties for a stage item.

### Properties

- `mass` / `Mass` (optional): Mass value
- `damping` / `Damping` (optional): Damping coefficient
- `restitution` / `Restitution` (optional): Restitution (bounciness) coefficient
- `hasCollision` / `HasCollision` (optional): Whether item participates in collisions. **Default**: `true`
- `canMove` / `CanMove` (optional): Whether item can move. **Default**: `true`
- `hasGravity` / `HasGravity` (optional): Whether item is affected by gravity. **Default**: `true`
- `canRotate` / `CanRotate` (optional): Whether item can rotate. **Default**: `true`
- `collisionBox` / `CollisionBox` / `boundingBox` / `BoundingBox` (optional): Custom collision box
  - `minX`: Minimum X boundary
  - `minY`: Minimum Y boundary
  - `maxX`: Maximum X boundary
  - `maxY`: Maximum Y boundary

### Example
```json
{
  "mass": 100,
  "damping": 0.5,
  "restitution": 0.5,
  "hasCollision": true,
  "canMove": true,
  "hasGravity": true,
  "canRotate": true,
  "collisionBox": {
    "minX": 0.4,
    "minY": 0.3,
    "maxX": 0.45,
    "maxY": 1
  }
}
```

## Transformer Object

Represents a behavior transformer that modifies item physics or movement.

### Properties

- `Type` / `type` (required): Transformer type (see [Transformer Types](#transformer-types))
- `Params` / `params` (optional): Transformer-specific parameters

### Transformer Types

#### `FlightKeyboardController`
Keyboard input controller for flying avatars.

**Params**:
- `linearAccel` (optional): Linear acceleration
- `linearBrake` (optional): Linear braking force
- `linearDamping` (optional): Linear damping
- `maxSpeed` (optional): Maximum speed
- `angularAccel` (optional): Angular acceleration
- `angularDamping` (optional): Angular damping
- `maxOmega` (optional): Maximum angular velocity

#### `FlightTouchController`
Touch input controller for flying avatars.

**Params**: Same as `FlightKeyboardController`, plus:
- `maxDistance` (optional): Pixels distance for full strength
- `minMovementThreshold` (optional): Minimum touch movement to trigger action

#### `WalkingController`
Walking input controller (left/right + jump). Pairs with `WalkingTransformer`.

**Params**: None

#### `WalkingTransformer`
Walking movement transformer with grounded jumping and upright correction.

**Params**:
- `moveAccel` (optional): Horizontal acceleration
- `maxSpeed` (optional): Maximum horizontal speed
- `jumpImpulse` (optional): Vertical jump impulse
- `airControl` (optional): Airborne horizontal control multiplier
- `uprightForce` (optional): Rotation correction strength
- `groundedEpsilon` (optional): Grounded detection threshold

#### `FollowItem`
Follows another item (usually the Avatar).

**Params**:
- `TargetId` (optional): Target item ID (use `"Avatar"` for avatar)
- `Distance` (optional): Distance to maintain
- `maxSpeed` (optional): Maximum following speed
- `force` (optional): Force applied
- `direction` (optional): Direction constraint (`"horizontal"`, etc.)

#### `StayUpright`
Maintains upright orientation.

**Params**:
- `latency` (optional): Response latency
- `maxAngle` (optional): Maximum angle deviation
- `speed` (optional): Correction speed
- `force` (optional): Correction force

#### `Glider`
Gliding flight behavior.

**Params**:
- `horizontalSpeed` (optional): Horizontal movement speed
- `glideEfficiency` (optional): Glide efficiency
- `minSpeedForLift` (optional): Minimum speed for lift
- `maxClimbRate` (optional): Maximum climb rate
- `minDistanceToBoundary` (optional): Minimum distance to map boundary
- `boundaryAvoidanceStrength` (optional): Boundary avoidance force
- `lookAheadDistance` (optional): Look-ahead distance for collision avoidance
- `lookAheadTime` (optional): Look-ahead time
- `collisionAvoidanceStrength` (optional): Collision avoidance force

#### `Glider2`
Alternative glider implementation.

**Params**: Varies by implementation (may be empty)

#### `Rotator`
Applies rotation behavior.

**Params**: Varies by implementation

#### `Drifter`
Drifting movement behavior.

**Params**:
- `force` (optional): Drift force
- `directionChangeInterval` (optional): Interval for direction changes

#### `Wobbler`
Wobbling movement behavior.

**Params**: Varies by implementation

### Example
```json
{
  "Type": "FlightKeyboardController",
  "Params": {
    "linearAccel": 2.5,
    "maxSpeed": 4.0,
    "angularAccel": 1200,
    "maxOmega": 300
  }
}
```

## Field Name Variations

The parser supports both **PascalCase** and **camelCase** for most field names. For example:
- `Name` or `name`
- `Position` or `position`
- `X` or `x`
- `PhysicsConfiguration` or `physicsConfiguration`

This provides flexibility for different JSON naming conventions.

## Complete Example

See `src/assets/maps/example.json` for a comprehensive example with all features.

## Minimal Example

```json
{
  "Name": "Test Level",
  "Size": { "X": 15, "Y": 5 },
  "Camera": {
    "Position": { "X": 5, "Y": 5 },
    "Zoom": 1.0
  },
  "Design": {
    "Color": "#118800"
  },
  "Obstacles": [],
  "Targets": [],
  "Avatar": {
    "Pose": {
      "Position": { "X": 1, "Y": 3 },
      "Size": { "X": 1, "Y": 1 }
    },
    "Design": {
      "Color": "transparent",
      "Image": "assets/game/bird.svg"
    },
    "PhysicsConfiguration": {
      "hasGravity": false,
      "canMove": true
    }
  }
}
```
