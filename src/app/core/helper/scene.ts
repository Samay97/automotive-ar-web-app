import {
  ArcRotateCamera,
  HardwareScalingOptimization,
  Scene,
  SceneOptimizer,
  SceneOptimizerOptions,
  TextureOptimization,
  Vector3,
} from '@babylonjs/core';

export const setupArcRotateCamera = (scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera => {
  const camera = new ArcRotateCamera('camera', 0, 0, 5, Vector3.Zero(), scene);
  camera.setTarget(Vector3.Zero());
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 1.5;
  camera.pinchPrecision = 100;
  camera.minZ = 0.1;
  camera.wheelPrecision = 50;
  camera.beta = 1.2;
  camera.alpha = 1.13;
  camera.radius = 6;
  camera.upperBetaLimit = 1.34;
  return camera;
};

export const addSceneOptimizer = (scene: Scene) => {
  const options = new SceneOptimizerOptions(45, 2000);
  options.addOptimization(new HardwareScalingOptimization(0, 1.5, 0.25));
  options.addOptimization(new TextureOptimization(1, 1024));

  // Optimizer
  const optimizer = new SceneOptimizer(scene, options);
  optimizer.start();

  setTimeout(() => {
    optimizer.stop();
  }, 10000);
};
