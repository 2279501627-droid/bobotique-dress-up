export function bindControls(engine, wardrobe) {
  const { camera, controls } = engine;
  const spin = document.querySelector('#spin');
  document.querySelector('#left').onclick = () => { if (wardrobe.character) wardrobe.character.root.rotation.y += Math.PI / 4; };
  document.querySelector('#zoom').onclick = () => {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(Math.max(controls.minDistance, offset.length() * 0.82));
    camera.position.copy(controls.target).add(offset); controls.update();
  };
  document.querySelector('#reset').onclick = () => {
    controls.reset(); wardrobe.resetRotation(); engine.frame(); controls.autoRotate = false; spin.setAttribute('aria-pressed', 'false');
  };
  spin.onclick = () => { controls.autoRotate = !controls.autoRotate; spin.setAttribute('aria-pressed', String(controls.autoRotate)); };
}
