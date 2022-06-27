import { WebXRFeaturesManager } from '@babylonjs/core';
import { lensFlarePixelShader } from '@babylonjs/core/Shaders/lensFlare.fragment';

export enum DeviceSupport {
  ALL = 'all',
  WITHOUTEXPERIMENTAL = 'without experimental',
  NONE = 'none',
}

export class XRSession {
  constructor() {}

  public static async checkDeviceSupport(): Promise<boolean> {
    /* WebXR isn't available */
    if ('xr' in window.navigator === false) return false;

    /* WebXR can be used! */
    const nav: any = navigator;
    const session = nav.xr.isSessionSupported('immersive-ar');
    if (!session) return false;

    /* Immersive AR can be used! */
    return true;
  }
}
