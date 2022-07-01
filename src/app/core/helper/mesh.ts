import { BoundingBox, Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';

const getMaterial = (materialName: string, color: string, scene: Scene): StandardMaterial => {
  let material = scene.getMaterialByName(materialName) as StandardMaterial;
  if (!material || material.diffuseColor.toHexString() !== color) {
    material = new StandardMaterial(materialName, scene);
    material.diffuseColor = Color3.FromHexString(color);
  }
  return material;
};

/**
 * Create basic box
 * @param scene
 * @param color Hex Color of box
 * @returns
 */
export const buildBoxMesh = (scene: Scene, color = '#3AAFA9'): Mesh => {
  const box = MeshBuilder.CreateBox('box', { size: 0.08 }, scene);
  box.material = getMaterial('boxMaterial', color, scene);
  box.isVisible = true;
  return box;
};

/**
 * Create basic cone
 * @param scene
 * @param color Hex Color of cone
 * @returns
 */
export const buildConeMesh = (scene: Scene, color = '#3AAFA9'): Mesh => {
  const cone = MeshBuilder.CreateCylinder(
    'cone',
    { diameterTop: 0, tessellation: 64, subdivisions: 2, height: 0.6, diameterBottom: 0.3 },
    scene
  );
  cone.material = getMaterial('coneMaterial', color, scene);
  cone.isVisible = true;
  return cone;
};

/**
 * Create bound box for debug purpose
 * @param bounds
 * @param scene
 */
export const createTestBoundsVisuals = (bounds: BoundingBox, scene: Scene): Mesh => {
  const size = new Vector3(
    bounds.maximum.x - bounds.minimum.x,
    bounds.maximum.y - bounds.minimum.y,
    bounds.maximum.z - bounds.minimum.z
  );

  const boundsTestCube = MeshBuilder.CreateBox(
    'boundsBox',
    {
      width: size.x,
      height: size.y,
      depth: size.z,
    },
    scene
  );

  boundsTestCube.position.x = bounds.minimum.x + size.x / 2;
  boundsTestCube.position.y = bounds.minimum.y + size.y / 2;
  boundsTestCube.position.z = bounds.minimum.z + size.z / 2;

  boundsTestCube.material = new StandardMaterial('boundsBoxMat', scene);
  boundsTestCube.material.alpha = 0;
  boundsTestCube.showBoundingBox = true;

  return boundsTestCube;
};
