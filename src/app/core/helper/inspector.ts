import { environment } from 'src/environments/environment';

export const loadInspector = () => {
  if (environment.production) {
    import('@babylonjs/core/Debug/debugLayer');
    import('@babylonjs/inspector');
  }
};
