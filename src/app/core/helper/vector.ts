import { AbstractMesh, BoundingBox, Matrix, Quaternion, TransformNode, Vector3, Node, Tools } from '@babylonjs/core';

export const getCenterOfVectors = (transformationMatrix: Matrix[]): Vector3 => {
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

export const getSizeFromBounds = (bounds: BoundingBox): Vector3 => {
  const size = new Vector3(
    bounds.maximum.x - bounds.minimum.x,
    bounds.maximum.y - bounds.minimum.y,
    bounds.maximum.z - bounds.minimum.z
  );
  return size;
};

export const getSizeFromNode = (parent: Node | TransformNode | AbstractMesh): Vector3 => {
  const sizes = parent.getHierarchyBoundingVectors();
  const size = {
    x: sizes.max.x - sizes.min.x,
    y: sizes.max.y - sizes.min.y,
    z: sizes.max.z - sizes.min.z,
  };
  return new Vector3(size.x, size.y, size.z);
};

export const getCarRotation = (bounds: BoundingBox): number => {
  const v1 = bounds.minimum;
  const v2 = bounds.maximum;

  const length1 = Math.abs(v2.x - v1.x);
  const length2 = Math.abs(v2.z - v1.z);

  // if x length is longer rotate car by 90 deg
  return length1 >= length2 ? Tools.ToRadians(180 + 90) : Tools.ToRadians(180);
};
