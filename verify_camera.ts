import { Camera } from './src/app/core/rendering/camera';
import { Point } from './src/app/core/models/point';

function testCameraClamping() {
    console.log("Starting Camera Clamping Tests...");

    // Map size: 10x10
    const camera = new Camera(new Point(5, 5), 1.0);
    camera.setBounds(10, 10);

    // Test 1: Zoom 1.0, map 10x10. Viewport is 10x10. Center should be fixed at (5, 5).
    camera.setTarget(new Point(0, 0), 1.0);
    camera.update();
    console.log(`Test 1 (Zoom 1.0, Target 0,0): Expected (5, 5), Got (${camera.getTargetCenter().x}, ${camera.getTargetCenter().y})`);

    // Test 2: Zoom 2.0, map 10x10. Viewport is 5x5. 
    // halfViewWidth = 2.5. minX = 2.5, maxX = 7.5.
    camera.setTarget(new Point(0, 0), 2.0);
    console.log(`Test 2 (Zoom 2.0, Target 0,0): Expected (2.5, 2.5), Got (${camera.getTargetCenter().x}, ${camera.getTargetCenter().y})`);

    camera.setTarget(new Point(10, 10), 2.0);
    console.log(`Test 3 (Zoom 2.0, Target 10,10): Expected (7.5, 7.5), Got (${camera.getTargetCenter().x}, ${camera.getTargetCenter().y})`);

    // Test 4: Dynamic update
    camera.setTarget(new Point(0, 0), 2.0);
    // Simulate some updates
    for(let i=0; i<50; i++) camera.update();
    console.log(`Test 4 (After updates): Center (${camera.getTargetCenter().x.toFixed(2)}, ${camera.getTargetCenter().y.toFixed(2)})`);
    
    // Test 5: Zoom out larger than map
    camera.setTarget(new Point(5, 5), 0.5); // Viewport 20x20
    console.log(`Test 5 (Zoom 0.5): Expected (5, 5), Got (${camera.getTargetCenter().x}, ${camera.getTargetCenter().y})`);
}

testCameraClamping();
