// Transactional selection: failed or stale requests never replace a working look.
export class Wardrobe {
  constructor(loaders, scene, onChange = () => {}) {
    Object.assign(this, { loaders, scene, onChange });
    this.items = new Map(); this.requests = new Map(); this.characterRequest = 0; this.environmentRequest = 0;
  }
  async selectCharacter(config) {
    const request = ++this.characterRequest;
    const next = await this.loaders.loadCharacter(config);
    if (request !== this.characterRequest) { next.dispose(); return false; }
    for (const [slot, item] of this.items) if (item.config.type !== 'furniture') this.remove(slot, false);
    this.requests.clear(); // Invalidates pending equip operations for the old character.
    this.character?.dispose(); this.character = next;
    this.placeCharacter(); this.scene.add(next.root); this.onChange(); return true;
  }
  placeCharacter() {
    if (!this.character) return;
    const offset = this.character.config.transform?.position || [0, 0, 0];
    const spawn = this.environment?.config.spawn || [0, 0, 0];
    this.character.root.position.set(...offset.map((n, i) => n + spawn[i]));
  }
  async selectEnvironment(config) {
    const request = ++this.environmentRequest;
    const next = await this.loaders.loadEnvironment(config);
    if (request !== this.environmentRequest) { next.dispose(); return false; }
    this.environment?.dispose(); this.environment = next; this.scene.add(next.root); this.placeCharacter(); this.onChange(); return true;
  }
  async equip(config) {
    const token = Symbol(config.id), character = this.character;
    this.requests.set(config.slot, token);
    const load = { garment: 'loadGarment', accessory: 'loadAccessory', furniture: 'loadFurniture' }[config.type];
    const next = await this.loaders[load](config, character);
    if (this.requests.get(config.slot) !== token || (config.type !== 'furniture' && this.character !== character)) {
      next.dispose(); return false;
    }
    this.items.get(config.slot)?.dispose();
    this.items.set(config.slot, next);
    (next.parent || this.scene).add(next.root); this.onChange(); return true;
  }
  remove(slot, notify = true) {
    this.requests.delete(slot); this.items.get(slot)?.dispose(); this.items.delete(slot);
    if (notify) this.onChange();
  }
  resetRotation() {
    if (this.character) this.character.root.rotation.set(...(this.character.config.transform?.rotation || [0, 0, 0]));
  }
  update(delta) { this.character?.update(delta); }
  dispose() {
    this.characterRequest++; this.environmentRequest++;
    for (const slot of this.items.keys()) this.remove(slot, false);
    this.requests.clear(); this.character?.dispose(); this.environment?.dispose();
  }
}
