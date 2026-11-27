import { compatible, safeURL } from '../assets/catalog.js';
export function createUI(catalog, wardrobe, actions) {
  const status = document.querySelector('#status'), inventory = document.querySelector('#inventory');
  document.querySelector('#collection-title').textContent = catalog.store?.collection || 'WARDROBE';
  const store = document.querySelector('#store-link');
  const storeURL = safeURL(catalog.store?.url, catalog.baseURL);
  store.hidden = !storeURL; if (storeURL) store.href = storeURL;
  let busy = false, selectedProduct;
  const selectors = document.querySelector('#selectors');
  async function run(task) {
    if (busy) return;
    busy = true; refresh(); status.textContent = 'LOADING...'; actions.busy(true);
    try { await task(); status.textContent = `PLAYER / ${wardrobe.character.config.name.toUpperCase()}`; }
    catch (error) { status.textContent = error.message; console.error(error); }
    finally { busy = false; actions.busy(false); refresh(); }
  }
  const selectControls = [];
  function selector(labelText, entries, action, current) {
    if (entries.length < 2) return;
    const label = document.createElement('label'); label.textContent = labelText + ' ';
    const select = document.createElement('select');
    for (const entry of entries) { const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name; select.append(option); }
    select.onchange = () => run(() => action(entries.find(x => x.id === select.value)));
    label.append(select); selectors.append(label); selectControls.push({ select, current });
  }
  selector('Character', catalog.characters.filter(x => x.availability === 'available'), actions.character, () => wardrobe.character?.config.id);
  selector('Showroom', catalog.environments.filter(x => x.availability === 'available'), actions.environment, () => wardrobe.environment?.config.id);
  const animationLabel = document.createElement('label'); animationLabel.textContent = 'Pose ';
  const animation = document.createElement('select'); animationLabel.append(animation); selectors.append(animationLabel);
  animation.onchange = () => wardrobe.character?.play(animation.value);
  let animationCharacter;
  function refresh() {
    for (const { select, current } of selectControls) { select.disabled = busy; select.value = current() || ''; }
    const character = wardrobe.character;
    if (animationCharacter !== character) {
      animationCharacter = character; animation.replaceChildren();
      const idle = document.createElement('option'); idle.value = ''; idle.textContent = 'Rest pose'; animation.append(idle);
      for (const name of character?.clips.keys() || []) { const option = document.createElement('option'); option.value = name; option.textContent = name; animation.append(option); }
      animation.value = character?.config.animation || '';
    }
    animationLabel.hidden = !character?.clips.size; animation.disabled = busy;
    document.querySelector('#outfit-description').textContent = character?.config.outfitDescription || 'Choose an item to try it on';
    inventory.replaceChildren();
    for (const product of catalog.products.filter(x => x.availability !== 'hidden')) {
      const button = document.createElement('button');
      const available = product.availability === 'available';
      const fits = compatible(product, character?.config);
      const worn = wardrobe.items.get(product.slot)?.config.id === product.id;
      button.disabled = busy || !available || !fits;
      button.setAttribute('aria-pressed', String(worn));
      const title = document.createElement('span'); title.textContent = product.name;
      const detail = document.createElement('span');
      detail.textContent = !available ? product.availability.replace('-', ' ').toUpperCase() : !fits ? 'INCOMPATIBLE FIT' : worn ? 'EQUIPPED' : product.price == null ? 'TRY ON' : new Intl.NumberFormat('en', { style: 'currency', currency: product.currency }).format(product.price);
      button.append(title, document.createElement('br'), detail);
      button.onclick = () => run(async () => { selectedProduct = product; if (worn) wardrobe.remove(product.slot); else await wardrobe.equip(product); });
      inventory.append(button);
    }
    const equipped = document.querySelector('#equipped'); equipped.replaceChildren();
    for (const [slot, item] of wardrobe.items) {
      const button = document.createElement('button'); button.textContent = `Remove ${item.config.name}`; button.disabled = busy;
      button.onclick = () => wardrobe.remove(slot); equipped.append(button);
    }
    const link = document.querySelector('#product-link');
    const url = safeURL(selectedProduct?.shopifyUrl, catalog.baseURL);
    link.hidden = !url; if (url) { link.href = url; link.textContent = `SHOP ${selectedProduct.name}`; }
  }
  return { refresh, status: text => { status.textContent = text; } };
}
