import '@babylonjs/loaders/glTF';
import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';

import {
  ArcRotateCamera,
  AssetsManager,
  Color3,
  DeviceOrientationCamera,
  Engine,
  FreeCamera,
  HemisphericLight,
  IWebXRAnchor,
  IWebXRHitResult,
  IWebXRPlane,
  Mesh,
  MeshBuilder,
  PolygonMeshBuilder,
  Quaternion,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector2,
  Vector3,
  WebXRAnchorSystem,
  WebXRCamera,
  WebXRDefaultExperience,
  WebXRExperienceHelper,
  WebXRFeaturesManager,
  WebXRHitTest,
  WebXRPlaneDetector,
  WebXRSessionManager,
  WebXRState,
  ISceneLoaderAsyncResult,
  TransformNode,
  Nullable,
} from '@babylonjs/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { NgZone } from '@angular/core';
import { XRSession } from './xr-session';
import * as earcut from 'earcut';
(window as any).earcut = earcut;

export class App {
  private engine: Engine;
  private scene: Scene;
  private featureManager?: WebXRFeaturesManager;
  private webXR?: WebXRDefaultExperience;
  private webXRSessionManager?: WebXRSessionManager;
  private planeDetector?: WebXRPlaneDetector;

  private hitTestResult?: IWebXRHitResult | null;
  private cursor!: Mesh;

  private carRoot!: TransformNode;

  private windowResizeSubscription: Subscription = Subscription.EMPTY;

  constructor(canvas: HTMLCanvasElement, private ngZone: NgZone) {
    this.engine = new Engine(canvas);
    this.scene = new Scene(this.engine);
    this.registerWindowEvents();
    this.initXRSession();
    this.buildScene();

    this.startRender();
  }

  public async initXRSession(): Promise<void> {
    if (!XRSession.checkDeviceSupport()) {
      throw new Error('AR Session is not supported');
    }

    const sessionMode = 'immersive-ar';
    const xr: WebXRDefaultExperience = await this.scene.createDefaultXRExperienceAsync({ uiOptions: { sessionMode } });

    xr.baseExperience.onStateChangedObservable.add((state) => {
      switch (state) {
        case WebXRState.IN_XR:
        // XR is initialized and already submitted one frame
        case WebXRState.ENTERING_XR:
        // xr is being initialized, enter XR request was made
        case WebXRState.EXITING_XR:
        // xr exit request was made. not yet done.
        case WebXRState.NOT_IN_XR:
        // self explanatory - either out or not yet in XR
      }
    });

    const sessionManager: WebXRSessionManager = xr.baseExperience.sessionManager;
    const camera: WebXRCamera = xr.baseExperience.camera;

    const isSupported = await sessionManager.isSessionSupportedAsync(sessionMode);
    if (!isSupported) {
      throw new Error('AR Session is not supported');
    }

    const featureManager: WebXRFeaturesManager = xr.baseExperience.featuresManager;

    //const hitTest: WebXRHitTest = featureManager.enableFeature(WebXRHitTest.Name, 'latest', { entityTypes: ['plane'] }, true, true) as WebXRHitTest;
    const hitTest: WebXRHitTest = featureManager.enableFeature(
      WebXRHitTest.Name,
      'latest',
      {},
      true,
      true
    ) as WebXRHitTest;
    const anchors: WebXRAnchorSystem = featureManager.enableFeature(
      WebXRAnchorSystem.Name,
      'latest',
      {},
      true,
      true
    ) as WebXRAnchorSystem;

    // Anchors
    const allAnchors = new Map();
    const allBoxes = new Map();

    anchors.onAnchorAddedObservable.add((newAnchor: IWebXRAnchor) => {
      const box = this.buildBox();
      const rotationQuaternion = box.rotationQuaternion ?? undefined;
      newAnchor.transformationMatrix.decompose(undefined, rotationQuaternion, box.position);

      allAnchors.set(newAnchor.id, newAnchor);
      allBoxes.set(newAnchor.id, box);
    });

    anchors.onAnchorUpdatedObservable.add((updatedAnchor: IWebXRAnchor) => {
      const box = allBoxes.get(updatedAnchor.id);
      const rotationQuaternion = box.rotationQuaternion ?? undefined;
      updatedAnchor.transformationMatrix.decompose(undefined, rotationQuaternion, box.position);

      allAnchors.set(updatedAnchor.id, updatedAnchor);
      allBoxes.set(updatedAnchor.id, box);
    });

    anchors.onAnchorRemovedObservable.add((deletedAnchor: IWebXRAnchor) => {
      allAnchors.delete(deletedAnchor.id);
      allBoxes.delete(deletedAnchor.id);
    });

    let carPlaced = false;

    SceneLoader.ImportMeshAsync('Sketchfab_model', 'assets/porsche_4s_commpressed.glb', undefined, this.scene).then(
      (result: ISceneLoaderAsyncResult) => {
        const carRoot: TransformNode | undefined = result.transformNodes.find((el) => el.name === 'Sketchfab_model');
        if (carRoot) {
          this.carRoot = carRoot;
          carRoot.scaling = new Vector3(0.125, 0.125, 0.125);
          console.log('loaded - Car');
        }
      }
    );

    setInterval(() => {
      if (carPlaced) return;
      if (allAnchors.size !== 4) return;
      carPlaced = true;
      console.log('Placing car');

      const decomposedPostions: any[] = []; // 2d array with rotation, translation

      allAnchors.forEach((anchor: IWebXRAnchor, key: string) => {
        const rotation = new Quaternion();
        const translation = Vector3.Zero();
        decomposedPostions.push([rotation, translation]);
        anchor.transformationMatrix.decompose(undefined, rotation, translation);
      });

      let totalX = 0;
      let totalZ = 0;
      let totalY = 0;
      decomposedPostions.forEach((element: any[]) => {
        totalX += (element[1] as Vector3).x;
        totalZ += (element[1] as Vector3).z;
        totalY += (element[1] as Vector3).y;
      });

      const centerX = totalX / decomposedPostions.length;
      const centerZ = totalZ / decomposedPostions.length;
      const centerY = totalY / decomposedPostions.length;

      this.carRoot.position = new Vector3(centerX, centerY, centerZ);
    }, 4500);

    // const planeDetector: WebXRPlaneDetector = featureManager.enableFeature( WebXRPlaneDetector.Name, 'latest', { }, true, true) as WebXRPlaneDetector;
    // this.initPlaneDetector(planeDetector, sessionManager);

    hitTest.onHitTestResultObservable.add((results: IWebXRHitResult[]) => {
      if (results.length && this.cursor) {
        this.hitTestResult = results[0];

        const rotationQuaternion = this.cursor.rotationQuaternion ?? new Quaternion();
        this.hitTestResult.transformationMatrix.decompose(undefined, rotationQuaternion, this.cursor.position);
        this.cursor.isVisible = true;
      } else {
        this.cursor.isVisible = false;
        this.hitTestResult = null;
      }
    });

    this.scene.onPointerDown = () => {
      if (this.hitTestResult) {
        // this.hitTestResult.transformationMatrix.decompose(undefined, this.box.rotationQuaternion, this.box.position);
        // this.box.position.y += 0.1 / 2;
        // this.box.isVisible = false;

        if (allAnchors.size < 4) {
          anchors.addAnchorPointUsingHitTestResultAsync(this.hitTestResult).then(() => console.log('Added Anchor'));
        }
      }
    };
  }

  public buildBox(): Mesh {
    const box = MeshBuilder.CreateBox('box', { size: 0.1 }, this.scene);
    const boxMaterial = new StandardMaterial('boxMaterial', this.scene);
    boxMaterial.diffuseColor = Color3.FromHexString('#5853e6');
    box.material = boxMaterial;
    box.isVisible = true;
    return box;
  }

  public buildScene(): void {
    // Reticle
    this.cursor = MeshBuilder.CreateDisc('reticle', { radius: 0.05 }, this.scene);
    const reticleMaterial = new StandardMaterial('reticleMaterial', this.scene);
    reticleMaterial.diffuseColor = Color3.FromHexString('#FFFFFF');
    reticleMaterial.roughness = 1;
    this.cursor.material = reticleMaterial;
    this.cursor.isVisible = false;

    // Light
    const light = new HemisphericLight('light', new Vector3(-0.5, -1, -0.25), this.scene);
    light.diffuse = Color3.FromHexString('#ffffff');
    light.groundColor = Color3.FromHexString('#bbbbff');
    light.intensity = 1;
  }

  private registerWindowEvents(): void {
    this.windowResizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(10))
      .subscribe(() => this.engine?.resize());

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'i' && this.scene) {
        const debugLayer = this.scene.debugLayer;
        debugLayer.isVisible() ? debugLayer.hide() : debugLayer.show({ handleResize: true, overlay: true });
      }
    });
  }

  private async initPlaneDetector(
    planeDetector: WebXRPlaneDetector,
    sessionManager: WebXRSessionManager
  ): Promise<void> {
    //this.scene = await SceneLoader.LoadAsync('assets/', 'porsche_4s_commpressed.glb', this.engine);
    const planes: any[] = [];

    planeDetector.onPlaneAddedObservable.add((plane: any) => {
      if (plane.xrPlane.orientation === 'Vertical') return;

      plane.polygonDefinition.push(plane.polygonDefinition[0]);
      const polygon_triangulation = new PolygonMeshBuilder(
        'name',
        plane.polygonDefinition.map((p: any) => new Vector2(p.x, p.z)),
        this.scene
      );
      const polygon = polygon_triangulation.build(false, 0.01);
      plane.mesh = polygon;
      planes[plane.id] = plane.mesh;
      const mat = new StandardMaterial('mat', this.scene);
      mat.alpha = 0.5;
      // pick a random color
      mat.diffuseColor = Color3.Random();
      polygon.createNormals(true);
      plane.mesh.material = mat;

      plane.mesh.rotationQuaternion = new Quaternion();
      plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
    });

    planeDetector.onPlaneUpdatedObservable.add((plane: any) => {
      if (plane.xrPlane.orientation === 'Vertical') return;
      let mat;
      if (plane.mesh) {
        // keep the material, dispose the old polygon
        mat = plane.mesh.material;
        plane.mesh.dispose(false, false);
      }
      const some = plane.polygonDefinition.some((p: any) => !p);
      if (some) {
        return;
      }
      plane.polygonDefinition.push(plane.polygonDefinition[0]);
      const polygon_triangulation = new PolygonMeshBuilder(
        'name',
        plane.polygonDefinition.map((p: any) => new Vector2(p.x, p.z)),
        this.scene
      );
      const polygon = polygon_triangulation.build(false, 0.01);
      polygon.createNormals(true);
      plane.mesh = polygon;
      planes[plane.id] = plane.mesh;
      plane.mesh.material = mat;
      plane.mesh.rotationQuaternion = new Quaternion();
      plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
    });

    planeDetector.onPlaneRemovedObservable.add((plane) => {
      if (plane && planes[plane.id]) {
        planes[plane.id].dispose();
      }
    });

    sessionManager.onXRSessionInit.add(() => {
      planes.forEach((plane) => plane.dispose());
      while (planes.pop()) {}
    });
  }

  public startRender(): void {
    this.ngZone.runOutsideAngular(() => this.engine.runRenderLoop(() => this.scene.render()));
  }

  public stopRender(): void {
    this.ngZone.runOutsideAngular(() => this.engine.stopRenderLoop(() => this.scene.render()));
  }
}
