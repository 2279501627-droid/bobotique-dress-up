export function transform(object, config = {}) {
  object.position.fromArray(config.position || [0, 0, 0]);
  object.rotation.set(...(config.rotation || [0, 0, 0]));
  object.scale.fromArray(config.scale || [1, 1, 1]);
  return object;
}
