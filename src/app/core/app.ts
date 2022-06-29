import {
  ArcRotateCamera,
  Color3,
  Engine,
  IWebXRAnchor,
  IWebXRHitResult,
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
  WebXRFeaturesManager,
  WebXRHitTest,
  WebXRPlaneDetector,
  WebXRSessionManager,
  WebXRState,
  ISceneLoaderAsyncResult,
  TransformNode,
  WebXRLightEstimation,
  CubeTexture,
  AbstractMesh,
  BaseTexture,
  EventState,
  ShadowGenerator,
} from '@babylonjs/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { NgZone } from '@angular/core';
import { XRSession } from './xr-session';
import * as earcut from 'earcut';
(window as any).earcut = earcut;
import '@babylonjs/loaders/glTF';
import { ShadowOnlyMaterial } from '@babylonjs/materials';

const sessionMode = 'immersive-ar';

export class App {
  private engine: Engine;
  private scene: Scene;
  private featureManager!: WebXRFeaturesManager;
  private webXR?: WebXRDefaultExperience;
  private planeDetector?: WebXRPlaneDetector;
  private hitTestResult?: IWebXRHitResult | null;
  private windowResizeSubscription: Subscription = Subscription.EMPTY;

  private hitTestSystem!: WebXRHitTest;
  private anchorSystem!: WebXRAnchorSystem;
  private lightSystem!: WebXRLightEstimation;
  private shadowGenerator!: ShadowGenerator;

  private allAnchors = new Map();
  private anchorMeshs = new Map<number, AbstractMesh>();

  private carRoot: TransformNode | AbstractMesh | undefined;
  private cursor!: Mesh;

  public fps: string = '0';
  public carPlaced = false;

  constructor(canvas: HTMLCanvasElement, private ngZone: NgZone) {
    this.engine = new Engine(canvas);
    this.scene = new Scene(this.engine);
    this.registerWindowEvents();
    this.initXRSession(canvas);
    this.buildScene();
  }

  private async initXRSession(canvas: HTMLCanvasElement): Promise<void> {
    // check if WebXR and session is available
    if (!XRSession.checkDeviceSupport()) {
      throw new Error('AR Session is not supported');
    }

    // create camera for not immersive mode
    const camera = new ArcRotateCamera('camera', 0, 0, 5, Vector3.Zero(), this.scene);
    camera.setTarget(Vector3.Zero());
    camera.attachControl(canvas, true);
    camera.minZ = 0.1;
    camera.wheelPrecision = 50;
    camera.beta = 1.2;
    camera.alpha = 1.13;
    camera.radius = 6;

    const xr: WebXRDefaultExperience = await this.scene.createDefaultXRExperienceAsync({
      uiOptions: { sessionMode, referenceSpaceType: 'local-floor' },
    });
    this.webXR = xr;

    const sessionManager: WebXRSessionManager = xr.baseExperience.sessionManager;
    const webXRCamera: WebXRCamera = xr.baseExperience.camera;
    webXRCamera.minZ = 0.1;

    const isSupported = await sessionManager.isSessionSupportedAsync(sessionMode);
    if (!isSupported) {
      throw new Error('AR Session is not supported');
    }

    const featureManager: WebXRFeaturesManager = xr.baseExperience.featuresManager;
    this.featureManager = featureManager;

    // Activate features for webxr
    this.addAnchorSystem();
    this.addHitTest();
    this.addLightEstimation();

    xr.baseExperience.onStateChangedObservable.add((state) => {
      switch (state) {
        case WebXRState.IN_XR:
          console.log('IN_XR');
          break;
        case WebXRState.ENTERING_XR:
          console.log('ENTERING_XR');
          this.enterXR();
          break;
        case WebXRState.EXITING_XR:
          console.log('EXITING_XR');
          this.laveXR();
          break;
        case WebXRState.NOT_IN_XR:
        // self explanatory - either out or not yet in XR
      }
    });
  }

  private addHitTest(): void {
    this.hitTestSystem = this.featureManager.enableFeature(
      WebXRHitTest.Name,
      'latest',
      {},
      true,
      false
    ) as WebXRHitTest;

    this.hitTestSystem.onHitTestResultObservable.add(this.onHitResult, undefined, undefined, this);

    this.scene.onPointerDown = () => {
      if (this.hitTestResult && this.allAnchors.size < 4) {
        this.anchorSystem
          .addAnchorPointUsingHitTestResultAsync(this.hitTestResult)
          .then(() => console.log('Added Anchor'));
      }
    };
  }

  private addAnchorSystem(): void {
    this.anchorSystem = this.featureManager.enableFeature(
      WebXRAnchorSystem.Name,
      'latest',
      {},
      true,
      false
    ) as WebXRAnchorSystem;

    this.anchorSystem.onAnchorAddedObservable.add((newAnchor: IWebXRAnchor) => {
      const box = this.buildAnchorMesh();
      const rotationQuaternion = box.rotationQuaternion ?? undefined;
      newAnchor.transformationMatrix.decompose(undefined, rotationQuaternion, box.position);
      box.position.y += 0.1 / 2;

      this.allAnchors.set(newAnchor.id, newAnchor);
      this.anchorMeshs.set(newAnchor.id, box);

      if (this.allAnchors.size === 4) {
        this.placeCar();
      }
    });

    this.anchorSystem.onAnchorUpdatedObservable.add((updatedAnchor: IWebXRAnchor) => {
      const box = this.anchorMeshs.get(updatedAnchor.id);
      if (!box) return;

      const rotationQuaternion = box.rotationQuaternion ?? undefined;
      updatedAnchor.transformationMatrix.decompose(undefined, rotationQuaternion, box.position);

      this.allAnchors.set(updatedAnchor.id, updatedAnchor);
      this.anchorMeshs.set(updatedAnchor.id, box);
    });

    this.anchorSystem.onAnchorRemovedObservable.add((deletedAnchor: IWebXRAnchor) => {
      this.allAnchors.delete(deletedAnchor.id);
      this.anchorMeshs.delete(deletedAnchor.id);
    });
  }

  private onHitResult(results: IWebXRHitResult[]): void {
    if (results.length && this.cursor) {
      this.hitTestResult = results[0];
      const rotationQuaternion = this.cursor.rotationQuaternion ?? new Quaternion();
      this.hitTestResult.transformationMatrix.decompose(undefined, rotationQuaternion, this.cursor.position);
      this.cursor.isVisible = true;
    } else {
      this.cursor.isVisible = false;
      this.hitTestResult = null;
    }
  }

  private addLightEstimation(): void {
    this.lightSystem = this.featureManager.enableFeature(
      WebXRLightEstimation.Name,
      'latest',
      {
        setSceneEnvironmentTexture: true,
        cubeMapPollInterval: 1000,
        createDirectionalLightSource: true,
        reflectionFormat: 'rgba16f',
      },
      true,
      false
    ) as WebXRLightEstimation;

    if (this.lightSystem.directionalLight) {
      console.log('SHadow gen');
      this.shadowGenerator = new ShadowGenerator(1024, this.lightSystem.directionalLight);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.useKernelBlur = true;
      this.shadowGenerator.blurKernel = 40;
      this.shadowGenerator.setDarkness(0.2);
    }

    this.lightSystem.onReflectionCubeMapUpdatedObservable.add((eventData: BaseTexture, eventState: EventState) => {
      console.log(eventData);
      console.log(this.lightSystem.directionalLight?.intensity);
    });
  }

  private buildAnchorMesh(): Mesh {
    // const box = MeshBuilder.CreateCapsule('box', { radius: 0.01, tessellation: 16, height: 1 }, this.scene);
    const box = MeshBuilder.CreateBox('box', { size: 0.1 }, this.scene);
    const boxMaterial = new StandardMaterial('boxMaterial', this.scene);
    boxMaterial.diffuseColor = Color3.FromHexString('#5853e6');
    box.material = boxMaterial;
    box.isVisible = true;
    return box;
  }

  private buildScene(): void {
    // Reticle
    this.cursor = MeshBuilder.CreateDisc('reticle', { radius: 0.05 }, this.scene);
    const reticleMaterial = new StandardMaterial('reticleMaterial', this.scene);
    reticleMaterial.diffuseColor = Color3.FromHexString('#FFFFFF');
    reticleMaterial.roughness = 1;
    this.cursor.material = reticleMaterial;
    this.cursor.isVisible = false;

    // Car
    SceneLoader.ImportMeshAsync('Sketchfab_model', 'assets/gtr.glb', undefined, this.scene).then(
      (result: ISceneLoaderAsyncResult) => {
        let carRoot: TransformNode | AbstractMesh | undefined = result.transformNodes.find(
          (el) => el.name === 'Sketchfab_model'
        );
        if (!carRoot) carRoot = result.meshes.find((el) => el.name === 'Sketchfab_model');
        if (carRoot) {
          this.carRoot = carRoot;
          carRoot.position.y += 0.0045; // fix rims under shadow plane on zero
          carRoot.scaling = new Vector3(1, 1, 1);
          // carRoot.setPivotMatrix(Matrix.Translation(0,1,0), false); // set pivot to center of car
          console.log('loaded - Car');

          if (this.shadowGenerator) {
            result.meshes.forEach((mesh: AbstractMesh) => {
              this.shadowGenerator.getShadowMap()?.renderList?.push(mesh);
            });
          }
        }
      }
    );

    // Ground
    const shadowMaterial = new ShadowOnlyMaterial('shadowOnly', this.scene);
    const ground = MeshBuilder.CreateGround('ground', { width: 30, height: 30 }, this.scene);
    ground.receiveShadows = true;
    ground.material = shadowMaterial;

    // HDR
    const hdrTexture = CubeTexture.CreateFromPrefilteredData('assets/environment.env', this.scene);
    this.scene.environmentTexture = hdrTexture;
    const skybox = this.scene.createDefaultSkybox(hdrTexture, true, 80, 0.3);
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

  private placeCar(): void {
    let totalX = 0;
    let totalZ = 0;
    let totalY = 0;

    this.allAnchors.forEach((anchor: IWebXRAnchor, key: string) => {
      const rotation = new Quaternion();
      const translation = new Vector3();
      anchor.transformationMatrix.decompose(undefined, rotation, translation);

      totalX += translation.x;
      totalZ += translation.z;
      totalY += translation.y;
    });

    const centerX = totalX / this.allAnchors.size;
    const centerZ = totalZ / this.allAnchors.size;
    const centerY = totalY / this.allAnchors.size;
    this.carRoot?.setAbsolutePosition(new Vector3(centerX, centerY, centerZ));
    this.carRoot?.setEnabled(true);
    this.carPlaced = true;
    console.log('Car position updated');

    // Reset all anchor and helper meshes
    this.anchorMeshs.forEach((anchor: AbstractMesh) => anchor.setEnabled(false));
    this.hitTestSystem.onHitTestResultObservable.removeCallback(this.onHitResult, this);
    this.cursor.dispose();
    this.hitTestResult = null;
  }

  private async initPlaneDetector(
    planeDetector: WebXRPlaneDetector,
    sessionManager: WebXRSessionManager
  ): Promise<void> {
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

  private enterXR(): void {
    this.scene.getMeshByName('hdrSkyBox')?.dispose();
    //this.scene.environmentTexture?.dispose();
    this.carRoot?.setEnabled(false);
  }

  private laveXR(): void {
    // TODO
  }

  public startRender(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
      this.fps = this.engine.getFps().toFixed();
    });
  }

  public stopRender(): void {
    this.ngZone.runOutsideAngular(() => this.engine.stopRenderLoop(() => this.scene.render()));
  }

  public enterXRMode(): void {
    this.enterXR();
    this.webXR?.baseExperience.enterXRAsync(sessionMode, 'local-floor').then(() => console.log('IN XR'));
  }
}
