import { Matrix, Quaternion, Vector3 } from '@babylonjs/core';

export const calculateCenterOfVectors = (transformationMatrix: Matrix[]): Vector3 => {
  let totalX = 0;
  let totalZ = 0;
  let totalY = 0;

  transformationMatrix.forEach((matrix: Matrix) => {
    const rotation = new Quaternion();
    const translation = new Vector3();
    matrix.decompose(undefined, rotation, translation);

    totalX += translation.x;
    totalZ += translation.z;
    totalY += translation.y;
  });

  const centerX = totalX / transformationMatrix.length;
  const centerZ = totalZ / transformationMatrix.length;
  const centerY = totalY / transformationMatrix.length;
  return new Vector3(centerX, centerY, centerZ);
};
