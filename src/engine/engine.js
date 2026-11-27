import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export function createEngine(stage, settings = {}) {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(37, 1, 0.05, 100);
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = settings.exposure ?? 1;
  stage.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D fashion avatar. Drag to rotate; pinch or scroll to zoom.');
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.05;
  controls.maxDistance = 6;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.autoRotateSpeed = 1;
  const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  RectAreaLightUniformsLib.init();
  const lights = new T.Group(); scene.add(lights);
  let subject, lastTime, update = () => {}, paused = () => false, lost = false;
  function setEnvironment(config) {
    scene.background = new T.Color(config.background || '#21192c');
    lights.clear();
    const lighting = config.lighting || {};
    const hemi = lighting.hemisphere || { sky: '#ffffff', ground: '#665075', intensity: 0.8 };
    lights.add(new T.HemisphereLight(hemi.sky, hemi.ground, hemi.intensity));
    scene.environmentIntensity = lighting.environmentIntensity ?? 0.65;
    for (const p of lighting.panels || []) {
      const light = new T.RectAreaLight(p.color, p.intensity, p.width, p.height);
      light.position.fromArray(p.position); light.lookAt(new T.Vector3(...p.target)); lights.add(light);
    }
  }
  function frame() {
    if (!subject) return;
    const bounds = new T.Box3().setFromObject(subject), size = bounds.getSize(new T.Vector3());
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new T.Vector3());
    controls.target.copy(center);
    const angle = T.MathUtils.degToRad(camera.fov / 2);
    const distance = Math.max(size.y * 0.594 / Math.tan(angle), Math.max(size.x, size.z) * 0.75 / (Math.tan(angle) * camera.aspect));
    controls.minDistance = Math.max(0.2, size.y * 0.636);
    controls.maxDistance = Math.max(distance * 2, size.y * 3.64);
    camera.position.copy(center).add(new T.Vector3(0, size.y * 0.091, distance));
    controls.update(); controls.saveState();
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, settings.maxPixelRatio ?? 1.75, Math.sqrt((settings.maxPixels ?? 1800000) / (w * h))));
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(stage); resize();
  function render(time) {
    const delta = lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, 0.05); lastTime = time;
    if (!paused()) { controls.update(delta); update(delta); }
    renderer.render(scene, camera);
  }
  function resume() { lastTime = undefined; renderer.setAnimationLoop(document.hidden || lost ? null : render); }
  document.addEventListener('visibilitychange', resume);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; resume(); engine.onContextLost?.(); });
  renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());
  const engine = { scene, camera, renderer, controls, setEnvironment, frame,
    setSubject(root) { subject = root; frame(); },
    start(onUpdate, isPaused) { update = onUpdate; paused = isPaused; resume(); },
    dispose() {
      renderer.setAnimationLoop(null); observer.disconnect(); document.removeEventListener('visibilitychange', resume);
      controls.dispose(); environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
  return engine;
}
