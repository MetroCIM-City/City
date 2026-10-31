import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color4,
  Color3,
  CubeTexture,
  Texture,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Mesh,
  ActionManager,
  ExecuteCodeAction,
  AppendSceneAsync,
} from "@babylonjs/core";
import { DracoDecoder } from "@babylonjs/core/Meshes/Compression/dracoDecoder.js";
import "@babylonjs/loaders/glTF/2.0/glTFLoader.js";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_draco_mesh_compression.js";
import { allItems } from "../data/campus.js";

DracoDecoder.DefaultConfiguration = {
  wasmUrl: "/assets/draco/draco_wasm_wrapper_gltf.js",
  wasmBinaryUrl: "/assets/draco/draco_decoder_gltf.wasm",
  fallbackUrl: "/assets/draco/draco_decoder_gltf.js",
};

function markerTexture(scene, hex) {
  const tex = new DynamicTexture(`poi-tex-${hex}-${Math.random()}`, { width: 128, height: 128 }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fillStyle = hex;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(46, 46, 36, 36);
  ctx.strokeStyle = hex;
  ctx.lineWidth = 4;
  ctx.strokeRect(46, 46, 36, 36);
  tex.update();
  return tex;
}

export class CampusViewer {
  constructor(canvas, { onSelect } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.markers = new Map();
    this.categoryVisible = new Map();
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(1, 1, 1, 1);
    this.scene.imageProcessingConfiguration.contrast = 1.04;
    this.scene.imageProcessingConfiguration.exposure = 1.12;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = false;

    this.camera = new ArcRotateCamera("cam", 1.59, 1.08, 840, new Vector3(-250, 8, -320), this.scene);
    this.camera.attachControl(canvas, true, false, 0);
    this.camera.panningSensibility = 40;
    this.camera.wheelPrecision = 2.4;
    this.camera.lowerRadiusLimit = 80;
    this.camera.upperRadiusLimit = 1600;
    this.camera.lowerBetaLimit = 0.18;
    this.camera.upperBetaLimit = Math.PI / 2.2;
    this.camera.panningAxis = new Vector3(1, 0, 1);
    this.camera.inertia = 0.78;
    this.camera.panningInertia = 0.7;
    this.home = {
      alpha: 1.59,
      beta: 1.08,
      radius: 840,
      target: new Vector3(-250, 8, -320),
    };
    window.campusViewer = this;

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.15), this.scene);
    hemi.intensity = 1.05;
    hemi.diffuse = new Color3(1, 1, 1);
    hemi.groundColor = new Color3(0.78, 0.82, 0.76);
    const sun = new DirectionalLight("sun", new Vector3(-0.35, -1, 0.25), this.scene);
    sun.intensity = 0.35;
    sun.diffuse = new Color3(1, 0.98, 0.94);

    this.ready = this._load();
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  async _load() {
    try {
      this.scene.environmentTexture = CubeTexture.CreateFromPrefilteredData("/assets/environment.env", this.scene);
      this.scene.environmentIntensity = 0.72;
    } catch {
      /* env is optional */
    }

    await AppendSceneAsync("/assets/gltf/environment.glb", this.scene);
    await AppendSceneAsync("/assets/gltf/buildings.glb", this.scene);

    const bounds = { min: new Vector3(1e6, 1e6, 1e6), max: new Vector3(-1e6, -1e6, -1e6) };
    for (const m of this.scene.meshes) {
      if (!m.getBoundingInfo || !m.isVisible) continue;
      if (/^poi-|__root__/i.test(m.name)) continue;
      const bi = m.getBoundingInfo().boundingBox;
      const ext = bi.maximumWorld.subtract(bi.minimumWorld);
      const c = bi.centerWorld;
      if (ext.x + ext.y + ext.z < 1) continue;
      if (c.y > 200 || c.y < -30) continue;
      if (ext.x > 2000 || ext.z > 2000) continue;
      bounds.min.minimizeInPlace(bi.minimumWorld);
      bounds.max.maximizeInPlace(bi.maximumWorld);
    }
    this.bounds = bounds;

    const groundMesh = this.scene.meshes.find((m) => m.name === "ground");
    if (groundMesh) {
      const gmat = new StandardMaterial("campus-ground-mat", this.scene);
      const tex = new Texture("/assets/img/ground.jpg", this.scene);
      tex.vScale = -1;
      gmat.diffuseTexture = tex;
      gmat.specularColor = Color3.Black();
      gmat.emissiveColor = new Color3(0.12, 0.12, 0.1);
      groundMesh.material = gmat;
    }

    this._buildMarkers();
  }

  _buildMarkers() {
    const originX = -380;
    const originZ = -250;
    const spanX = 170;
    const spanZ = 200;
    const y = 44;

    for (const item of allItems()) {
      const [nx, nz] = item.marker;
      const pos = new Vector3(originX + nx * spanX, y, originZ + nz * spanZ);
      const plane = MeshBuilder.CreatePlane(`poi-${item.id}`, { size: 9 }, this.scene);
      plane.position = pos;
      plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      const mat = new StandardMaterial(`poi-mat-${item.id}`, this.scene);
      mat.diffuseTexture = markerTexture(this.scene, item.color);
      mat.emissiveColor = Color3.FromHexString(item.color).scale(0.35);
      mat.opacityTexture = mat.diffuseTexture;
      mat.useAlphaFromDiffuseTexture = true;
      mat.backFaceCulling = false;
      mat.specularColor = Color3.Black();
      plane.material = mat;
      plane.isPickable = true;
      plane.metadata = { id: item.id };
      plane.actionManager = new ActionManager(this.scene);
      plane.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnPickTrigger, () => this.select(item.id)),
      );
      this.markers.set(item.id, { root: plane, inner: plane, categoryId: item.categoryId });
    }
  }

  setCategoryVisible(categoryId, visible) {
    this.categoryVisible.set(categoryId, visible);
    for (const marker of this.markers.values()) {
      if (marker.categoryId !== categoryId) continue;
      marker.root.setEnabled(visible);
    }
  }

  select(id) {
    const marker = this.markers.get(id);
    if (marker) this.flyTo(marker.root.position);
    this.onSelect?.(id);
  }

  flyTo(target) {
    const cam = this.camera;
    const to = target.clone();
    to.y += 2;
    const startT = cam.target.clone();
    const startR = cam.radius;
    const destR = Math.max(90, startR * 0.42);
    let k = 0;
    const step = () => {
      k += 0.04;
      const e = 1 - Math.pow(1 - Math.min(k, 1), 3);
      cam.setTarget(Vector3.Lerp(startT, to, e));
      cam.radius = startR + (destR - startR) * e;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  resetCamera() {
    const cam = this.camera;
    const startA = cam.alpha;
    const startB = cam.beta;
    const startR = cam.radius;
    const startT = cam.target.clone();
    let k = 0;
    const step = () => {
      k += 0.035;
      const e = 1 - Math.pow(1 - Math.min(k, 1), 3);
      cam.alpha = startA + (this.home.alpha - startA) * e;
      cam.beta = startB + (this.home.beta - startB) * e;
      cam.radius = startR + (this.home.radius - startR) * e;
      cam.setTarget(Vector3.Lerp(startT, this.home.target, e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
