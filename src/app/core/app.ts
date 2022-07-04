import {
  Engine,
  IWebXRAnchor,
  IWebXRHitResult,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
  WebXRAnchorSystem,
  WebXRCamera,
  WebXRDefaultExperience,
  WebXRFeaturesManager,
  WebXRHitTest,
  WebXRSessionManager,
  WebXRState,
  ISceneLoaderAsyncResult,
  TransformNode,
  WebXRLightEstimation,
  CubeTexture,
  AbstractMesh,
  ShadowGenerator,
  GroundMesh,
  WebXRBackgroundRemover,
  DirectionalLight,
  HemisphericLight,
  Matrix,
  BoundingBox,
  Space,
  Axis,
  LinesMesh,
} from '@babylonjs/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { NgZone } from '@angular/core';
import { XRSession } from './xr-session';
import '@babylonjs/loaders/glTF';
import { ShadowOnlyMaterial } from '@babylonjs/materials';
import { getCarRotation, getCenterOfVectors, getSizeFromBounds, getSizeFromNode } from './helper/vector';
import { buildBoxMesh, buildLineMesh, createTestBoundsVisuals, updateLineMesh } from './helper/mesh';
import { setupArcRotateCamera } from './helper/scene';
import { environment } from 'src/environments/environment';
import { GUI } from './gui';

const sessionMode = 'immersive-ar';

export class App {
  private engine: Engine;
  private scene: Scene;
  private featureManager!: WebXRFeaturesManager;
  private webXR?: WebXRDefaultExperience;
  private hitTestResult?: IWebXRHitResult | null;
  private windowResizeSubscription: Subscription = Subscription.EMPTY;
  private appUI: GUI;

  // Activated XR Features
  private hitTestSystem!: WebXRHitTest;
  private anchorSystem!: WebXRAnchorSystem;
  private lightSystem!: WebXRLightEstimation;
  private shadowGenerator!: ShadowGenerator;

  // Anchors with mesh and debug line
  private allAnchors = new Map<number, IWebXRAnchor>();
  private anchorMeshs = new Map<number, AbstractMesh>();
  private anchorLinePath: Vector3[] = [];
  private anchorLineLength: number = 0;

  // Scene Meshes
  private carRoot: TransformNode | AbstractMesh | undefined;
  private cursor!: Mesh;
  private lineAnchors!: LinesMesh;
  private ground!: GroundMesh;

  //
  public fps: string = '0';
  public carPlaced = false;

  constructor(canvas: HTMLCanvasElement, private ngZone: NgZone) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.appUI = new GUI(this.scene);
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
    const camera = setupArcRotateCamera(this.scene, canvas);

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
    this.addBackroundRemover();

    xr.baseExperience.onStateChangedObservable.add((state) => {
      switch (state) {
        case WebXRState.IN_XR:
          console.log('IN_XR');
          break;
        case WebXRState.ENTERING_XR:
          this.enterXR();
          break;
        case WebXRState.EXITING_XR:
          this.laveXR();
          break;
        case WebXRState.NOT_IN_XR:
        // self explanatory - either out or not yet in XR
      }
    });

    this.scene.onBeforeRenderObservable.add(this.onBeforeRender, undefined, false, this);
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
      const box = buildBoxMesh(this.scene, '#3AAFA8');
      const rotationQuaternion = box.rotationQuaternion ?? undefined;
      newAnchor.transformationMatrix.decompose(undefined, rotationQuaternion, box.position);
      box.position.y += box.position.y / 2; // center of box is used as position, box shoud be on surface

      this.allAnchors.set(newAnchor.id, newAnchor);
      this.anchorMeshs.set(newAnchor.id, box);
      this.appUI.updateText('Sub-Heading', `${this.allAnchors.size} / 2`);

      if (this.allAnchors.size === 2) {
        this.placeCar();
      } else {
        this.anchorLinePath.unshift(box.position);
      }
    });

    this.anchorSystem.onAnchorUpdatedObservable.add((updatedAnchor: IWebXRAnchor) => {
      const box = this.anchorMeshs.get(updatedAnchor.id);
      if (!box) return;

      const rotationQuaternion = box.rotationQuaternion ?? undefined;
      updatedAnchor.transformationMatrix.decompose(undefined, rotationQuaternion, box.position);

      this.allAnchors.set(updatedAnchor.id, updatedAnchor);
      this.anchorMeshs.set(updatedAnchor.id, box);
      this.anchorLinePath[0] = box.position;
    });

    this.anchorSystem.onAnchorRemovedObservable.add((deletedAnchor: IWebXRAnchor) => {
      this.allAnchors.delete(deletedAnchor.id);
      this.anchorMeshs.delete(deletedAnchor.id);
    });
  }

  private addBackroundRemover(): WebXRBackgroundRemover {
    return this.featureManager.enableFeature(WebXRBackgroundRemover.Name, 'latest', {
      environmentHelperRemovalFlags: {
        skyBox: true,
        ground: false,
      },
    }) as WebXRBackgroundRemover;
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
      this.lightSystem.directionalLight.intensity = 1;
      console.log('Shadow generated');
      this.lightSystem.directionalLight.shadowMinZ = 3;
      this.lightSystem.directionalLight.shadowMaxZ = 8;
      this.shadowGenerator = new ShadowGenerator(1024, this.lightSystem.directionalLight);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      if (this.ground && this.ground.material)
        (this.ground.material as ShadowOnlyMaterial).activeLight = this.lightSystem.directionalLight;
      this.shadowGenerator.setDarkness(0.2);
    }

    /*
    this.lightSystem.onReflectionCubeMapUpdatedObservable.add((eventData: BaseTexture, eventState: EventState) => {
      console.log(eventData);
      console.log(this.lightSystem.directionalLight?.intensity);
    });
    */
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

  // Debug
  private testLight(): void {
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    const dirLight = new DirectionalLight('light dir', new Vector3(0, -1, -0.5), this.scene);
    dirLight.position = new Vector3(0, 5, -5);

    this.shadowGenerator = new ShadowGenerator(1024 * 2, dirLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;
  }

  private buildScene(): void {
    // Cursor
    this.cursor = buildBoxMesh(this.scene);
    this.cursor.isVisible = false;
    (this.cursor.material! as StandardMaterial).roughness = 1;
    (this.cursor.material! as StandardMaterial).alpha = 0.5;

    // Ground
    const shadowMaterial = new ShadowOnlyMaterial('shadowOnly', this.scene);
    this.ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, this.scene);

    // TODO: Fix shadow
    //this.ground.receiveShadows = true;
    this.ground.material = shadowMaterial;
    this.ground.visibility = 0;

    // HDR
    const hdrTexture = CubeTexture.CreateFromPrefilteredData('assets/env/autumn_forest.env', this.scene);
    this.scene.environmentTexture = hdrTexture;
    const skybox = this.scene.createDefaultSkybox(hdrTexture, true, 80, 0.25);
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
    if (!this.carRoot) return;

    const transformationMatrix: Matrix[] = Array.from<IWebXRAnchor>(this.allAnchors.values()).map(
      (el) => el.transformationMatrix
    );
    const newPoint = getCenterOfVectors(transformationMatrix);

    const anchors = Array.from<AbstractMesh>(this.anchorMeshs.values());
    const newScaling = this.getCarScaleRelativeToAnchros(
      anchors.map((el: AbstractMesh) => el.position),
      true
    );

    this.appUI.toggle(false);

    // Update Car
    this.carRoot.setAbsolutePosition(newPoint);
    this.carRoot.setEnabled(true);
    this.carPlaced = true;
    console.log('Car position updated');
    this.carRoot.scaling = newScaling;
    console.log('Car Scale updated');

    // Update ground for shadow
    this.ground.setAbsolutePosition(newPoint);

    // Reset all anchor and helper meshes
    this.anchorMeshs.forEach((anchor: AbstractMesh) => anchor.dispose());
    this.hitTestSystem.onHitTestResultObservable.removeCallback(this.onHitResult, this);
    this.scene.onBeforeRenderObservable.removeCallback(this.onBeforeRender, this);
    this.cursor.dispose();
    this.hitTestResult = null;
  }

  private getCarScaleRelativeToAnchros(anchorPositions: Vector3[], rotateCar = false): Vector3 {
    if (!anchorPositions || anchorPositions.length !== 2)
      throw Error('anchorPosition missing for getCarScaleRelativeToAnchros');

    const bounds = new BoundingBox(anchorPositions[0], anchorPositions[1]);

    this.carRoot!.rotation = new Vector3(0, 0, 0);
    const yaw = getCarRotation(bounds);
    if (yaw && rotateCar) {
      this.carRoot!.rotate(Axis.Y, yaw, Space.WORLD);
    }

    // Debug, TODO Remove later
    // if (!environment.production) createTestBoundsVisuals(bounds, this.scene);

    const targetSize = getSizeFromBounds(bounds);
    const currentSize = getSizeFromNode(this.carRoot!);
    const relation = targetSize.divide(currentSize);

    // Get min value from size, car should always scaled in all 3 axes the same amout
    const min = Math.min(Math.abs(relation.x), Math.abs(relation.z)); // sz.y is not required we only need space in x and z height of object will be as it is
    return new Vector3(min, min, min);
  }

  private enterXR(): void {
    console.log('ENTERING_XR');
    this.scene.getMeshByName('hdrSkyBox')?.dispose();
    this.carRoot?.setEnabled(false);
    this.ground.setEnabled(false);
    this.appUI.toggle(true);
  }

  private laveXR(): void {
    this.appUI.toggle(false);
    console.log('EXITING_XR');
  }

  private onBeforeRender(): void {
    // Get Points for line
    if (this.anchorLinePath.length === 2 && this.lineAnchors && this.hitTestResult) {
      const [firstAnchor] = this.anchorMeshs.values();
      this.anchorLinePath = [firstAnchor.position, this.hitTestResult.position];
      this.lineAnchors = updateLineMesh(this.lineAnchors, this.anchorLinePath);
      this.updateAnchorLenght();
    } else if (this.anchorLinePath.length === 1 && this.hitTestResult) {
      this.anchorLinePath.push(this.hitTestResult.position);
      this.lineAnchors = buildLineMesh(this.scene, this.anchorLinePath);
    }
  }

  private updateAnchorLenght(): void {
    if (this.anchorLinePath.length !== 2) return;
    this.anchorLineLength = Vector3.Distance(this.anchorLinePath[0], this.anchorLinePath[1]);
    const scale = this.getCarScaleRelativeToAnchros([...this.anchorLinePath]);
    this.appUI.updateText('Footer', `Car Scale would be ${(scale.x * 100).toFixed(2)}%`);
  }

  public async loadCar(url: string = 'assets/gtr.glb'): Promise<void> {
    const result: ISceneLoaderAsyncResult = await SceneLoader.ImportMeshAsync(
      'Sketchfab_model',
      url,
      undefined,
      this.scene
    );

    let carRoot: TransformNode | AbstractMesh | undefined = result.transformNodes.find(
      (el) => el.name === 'Sketchfab_model'
    );
    if (!carRoot) carRoot = result.meshes.find((el) => el.name === 'Sketchfab_model');
    if (carRoot) {
      this.carRoot = carRoot;
      carRoot.position.y += 0.025; // fix rims under shadow plane on zero
      console.log('loaded - Car');

      if (this.shadowGenerator) {
        result.meshes.forEach((mesh: AbstractMesh) => {
          this.shadowGenerator.getShadowMap()?.renderList?.push(mesh);
        });
      }
    }
  }

  public startRender(): void {
    this.ngZone.runOutsideAngular(() =>
      this.engine.runRenderLoop(() => {
        this.scene.render();
        this.fps = this.engine.getFps().toFixed();
      })
    );
  }

  public stopRender(): void {
    this.ngZone.runOutsideAngular(() => this.engine.stopRenderLoop(() => this.scene.render()));
  }

  public enterXRMode(): void {
    this.enterXR();
    this.webXR?.baseExperience.enterXRAsync(sessionMode, 'local-floor').then(() => console.log('IN XR'));
  }
}
