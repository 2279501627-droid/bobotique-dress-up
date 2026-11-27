import { loadCatalog } from './assets/catalog.js';
import { createLoaders } from './assets/loaders.js';
import { createEngine } from './engine/engine.js';
import { Wardrobe } from './engine/wardrobe.js';
import { createUI } from './ui/catalog-ui.js';
import { bindControls } from './interactions/controls.js';
import { setupPhoto } from './interactions/photo.js';

async function start() {
  const status = document.querySelector('#status');
  let engine;
  try {
    const catalog = await loadCatalog(new URL('../config/catalog.json', import.meta.url).href);
    try { engine = createEngine(document.querySelector('#stage'), catalog.renderer); }
    catch (error) { throw new Error('3D unavailable. Enable WebGL or try another browser.', { cause: error }); }
    const loaders = createLoaders(catalog, engine.renderer);
    const photo = setupPhoto(engine);
    let ui;
    const wardrobe = new Wardrobe(loaders, engine.scene, () => ui?.refresh());
    async function character(config) {
      if (await wardrobe.selectCharacter(config)) engine.setSubject(wardrobe.character.root);
    }
    async function environment(config) {
      if (await wardrobe.selectEnvironment(config)) { engine.setEnvironment(config); engine.frame(); }
    }
    ui = createUI(catalog, wardrobe, { character, environment,
      busy(value) { photo.setReady(!value && !!wardrobe.character); },
    });
    bindControls(engine, wardrobe);
    engine.onContextLost = () => { photo.setReady(false); ui.status('3D paused. Restoring graphics...'); };
    await environment(catalog.environments.find(x => x.id === catalog.defaults.environment));
    await character(catalog.characters.find(x => x.id === catalog.defaults.character));
    ui.ready(); ui.status(`PLAYER / ${wardrobe.character.config.name.toUpperCase()}`);
    photo.setReady(true);
    engine.start(delta => wardrobe.update(delta), () => photo.open);
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
    document.querySelectorAll('nav button').forEach(button => { button.disabled = true; });
    engine?.dispose();
  }
}
start();
