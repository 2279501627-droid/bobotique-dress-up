// Reference-counted templates: concurrent loads share a promise. Live instances
// are never evicted; only a bounded number of unused templates remain cached.
export class AssetCache {
  constructor({ load, instantiate, dispose, maxIdle = 2 }) {
    Object.assign(this, { load, instantiate, dispose, maxIdle });
    this.entries = new Map();
    this.clock = 0;
  }
  async acquire(key) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { refs: 0, used: ++this.clock };
      this.entries.set(key, entry);
      entry.promise = Promise.resolve().then(() => this.load(key)).then(template => {
        entry.template = template;
        return template;
      }).catch(error => { this.entries.delete(key); throw error; });
    }
    entry.refs++;
    entry.used = ++this.clock;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      entry.refs--;
      entry.used = ++this.clock;
      this.trim();
    };
    try {
      const template = await entry.promise;
      const instance = this.instantiate(template);
      return { ...instance, release };
    } catch (error) { release(); throw error; }
  }
  trim() {
    const idle = [...this.entries.entries()].filter(([, e]) => e.refs === 0 && e.template)
      .sort((a, b) => b[1].used - a[1].used);
    for (const [key, entry] of idle.slice(this.maxIdle)) {
      this.dispose(entry.template);
      this.entries.delete(key);
    }
  }
}
