import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const spin = document.querySelector('#spin');
const scene = new T.Scene();
scene.background = new T.Color(0x21192c);
const camera = new T.PerspectiveCamera(37, 1, 0.05, 30);
let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
} catch (error) {
  status.textContent = '3D unavailable. Enable WebGL or try another browser.';
  document.querySelectorAll('nav button').forEach(button => button.disabled = true);
  throw error;
}
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.append(renderer.domElement);
renderer.domElement.setAttribute('aria-label', '3D founder avatar. Drag to rotate; pinch or scroll to zoom.');
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.05;
controls.maxDistance = 6;
controls.minPolarAngle = Math.PI * 0.15;
controls.maxPolarAngle = Math.PI * 0.55;
controls.autoRotateSpeed = 1;

// Broad emitters and a prefiltered neutral studio environment avoid hard
// point highlights. No shadow maps or full-screen postprocessing on mobile.
RectAreaLightUniformsLib.init();
scene.add(new T.HemisphereLight(0xf0edf7, 0x695671, 0.8));
for (const [position, intensity, width, height, color] of [
  [[-2.5, 3.4, 3], 3.5, 3, 4, 0xfff3e8],
  [[2.5, 2, 2], 2.2, 3, 3, 0xe9efff],
  [[0.5, 2.8, -2], 3, 2, 3, 0xeee6ff],
]) {
  const light = new T.RectAreaLight(color, intensity, width, height);
  light.position.set(...position);
  light.lookAt(0, 0.95, 0);
  scene.add(light);
}
const pmrem = new T.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture;
scene.environmentIntensity = 0.65;
room.dispose();
pmrem.dispose();

function box(w, h, d, x, y, z, color, metalness = 0) {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d),
    new T.MeshStandardMaterial({ color, metalness, roughness: 0.45 }));
  mesh.position.set(x, y, z);
  scene.add(mesh);
}
box(12, 0.1, 12, 0, -0.05, 0, 0x39234f);
box(8, 4, 0.1, 0, 2, -3, 0x302936);
for (const x of [-2.5, 2.5]) {
  box(0.06, 2, 0.06, x, 1, -2, 0xbfc3cc, 0.8);
  for (const y of [0.4, 1, 1.6]) box(1.2, 0.06, 0.5, x, y, -2, 0x9999a3, 0.7);
}
const platform = new T.Mesh(new T.CylinderGeometry(0.64, 0.67, 0.07, 64),
  new T.MeshStandardMaterial({ color: 0x39313f, metalness: 0.5, roughness: 0.4 }));
platform.position.y = 0.035;
scene.add(platform);
// A small procedural contact shadow anchors the feet without jagged shadow maps.
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 128;
const context = shadowCanvas.getContext('2d');
const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
gradient.addColorStop(0, 'rgba(0,0,0,0.30)');
gradient.addColorStop(1, 'rgba(0,0,0,0)');
context.fillStyle = gradient;
context.fillRect(0, 0, 128, 128);
const shadow = new T.Mesh(new T.PlaneGeometry(0.65, 0.45),
  new T.MeshBasicMaterial({ map: new T.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.071;
scene.add(shadow);

function prepareMesh(mesh) {
  const geometry = mesh.geometry;
  const normals = geometry.getAttribute('normal');
  // Preserve the authored seam normals. Only six vertices in this asset have
  // zero normals; recomputing everything would facet its disconnected UV islands.
  if (!normals) geometry.computeVertexNormals();
  else {
    const fallback = geometry.clone();
    fallback.computeVertexNormals();
    const repaired = fallback.getAttribute('normal');
    const n = new T.Vector3();
    for (let i = 0; i < normals.count; i++) {
      n.fromBufferAttribute(normals, i);
      if (n.lengthSq() < 0.01) {
        n.fromBufferAttribute(repaired, i);
        if (n.lengthSq() < 0.01) n.set(0, 1, 0);
      }
      n.normalize();
      normals.setXYZ(i, n.x, n.y, n.z);
    }
    normals.needsUpdate = true;
    fallback.dispose();
  }
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    material.flatShading = false;
    material.normalScale.setScalar(0.35);
    material.metalness = 0.12;
    material.roughness = 0.85;
    if (material.isMeshPhysicalMaterial) {
      material.ior = 1.4;
      material.specularIntensity = 0.65;
      material.clearcoat = 0;
    }
    // Keep the atlas and roughness variation; avoid oily highlights where the
    // generated map is near zero. Applies uniformly: no guessed skin masks.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor, 0.48, 0.88);');
    };
    material.customProgramCacheKey = () => 'bobotique-satin-v1';
    for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) {
      if (!texture) continue;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      // GLTFLoader already sets base colour to sRGB and data maps to linear.
      texture.needsUpdate = true;
    }
    material.needsUpdate = true;
  }
}

let model;
new GLTFLoader().load(new URL('../assets/founder.glb', import.meta.url).href, gltf => {
  model = gltf.scene;
  model.traverse(object => { if (object.isMesh) prepareMesh(object); });
  const bounds = new T.Box3().setFromObject(model);
  model.scale.setScalar(1.65 / bounds.getSize(new T.Vector3()).y);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new T.Vector3());
  model.position.set(-center.x, 0.07 - bounds.min.y, -center.z);
  scene.add(model);
  status.textContent = 'PLAYER 01 / FOUNDER';
}, undefined, error => {
  status.textContent = 'Character could not load. Reload to try again.';
  console.error(error);
});

function frameAvatar() {
  const vertical = T.MathUtils.degToRad(camera.fov / 2);
  const distance = Math.max(0.98 / Math.tan(vertical), 0.46 / (Math.tan(vertical) * camera.aspect));
  camera.position.set(0, 1.05, distance);
  controls.update();
  controls.saveState();
}
let firstResize = true;
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  // Bound framebuffer work on Retina iPhones, including landscape layouts.
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75, Math.sqrt(1800000 / (w * h))));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (firstResize) { frameAvatar(); firstResize = false; }
}
new ResizeObserver(resize).observe(stage);
resize();
document.querySelector('#left').onclick = () => { if (model) model.rotation.y += Math.PI / 4; };
document.querySelector('#zoom').onclick = () => {
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(Math.max(controls.minDistance, offset.length() * 0.82));
  camera.position.copy(controls.target).add(offset);
  controls.update();
};
document.querySelector('#reset').onclick = () => {
  controls.reset();
  frameAvatar();
  if (model) model.rotation.y = 0;
  controls.autoRotate = false;
  spin.setAttribute('aria-pressed', 'false');
};
spin.onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  spin.setAttribute('aria-pressed', String(controls.autoRotate));
};
let lastTime;
function render(time) {
  const delta = lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  controls.update(delta);
  renderer.render(scene, camera);
}
function resume() {
  lastTime = undefined;
  renderer.setAnimationLoop(document.hidden ? null : render);
}
document.addEventListener('visibilitychange', resume);
renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  renderer.setAnimationLoop(null);
  status.textContent = '3D paused. Restoring graphics...';
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  // Recreate the prefiltered environment after mobile Safari releases GPU memory.
  location.reload();
});
resume();
