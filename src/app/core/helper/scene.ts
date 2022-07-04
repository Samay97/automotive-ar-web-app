import { ArcRotateCamera, Scene, Vector3 } from '@babylonjs/core';

export const setupArcRotateCamera = (scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera => {
  const camera = new ArcRotateCamera('camera', 0, 0, 5, Vector3.Zero(), scene);
  camera.setTarget(Vector3.Zero());
  camera.attachControl(canvas, true);
  camera.minZ = 0.1;
  camera.wheelPrecision = 50;
  camera.beta = 1.2;
  camera.alpha = 1.13;
  camera.radius = 6;
  camera.upperBetaLimit = 1.34;
  return camera;
};
