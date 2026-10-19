const MAX_TILES = 15;
const STORAGE_KEY = 'favoriteTiles';
const INITIALIZED_KEY = 'favoriteTilesInitialized';
const PALETTES = [
  { id: 'red', name: 'Red', backgroundColor: '#FCE8E6', textColor: '#A50E0E' },
  { id: 'orange', name: 'Orange', backgroundColor: '#FCE8D5', textColor: '#9A3412' },
  { id: 'yellow', name: 'Yellow', backgroundColor: '#FFF7CC', textColor: '#854D0E' },
  { id: 'green', name: 'Green', backgroundColor: '#E2F3E5', textColor: '#166534' },
  { id: 'blue', name: 'Blue', backgroundColor: '#E1EEFF', textColor: '#1D4ED8' },
  { id: 'indigo', name: 'Indigo', backgroundColor: '#E8E7FF', textColor: '#3730A3' },
  { id: 'violet', name: 'Violet', backgroundColor: '#F1E5FF', textColor: '#6B21A8' },
  { id: 'grey', name: 'Grey', backgroundColor: '#ECEFF1', textColor: '#374151' },
  { id: 'pink', name: 'Pink', backgroundColor: '#FCE7F3', textColor: '#9D174D' },
  { id: 'teal', name: 'Teal', backgroundColor: '#DDF5F0', textColor: '#115E59' }
];

const grid = document.querySelector('#tile-grid');
const emptyState = document.querySelector('#empty-state');
const countLabel = document.querySelector('#tile-count');
const footerCount = document.querySelector('#footer-count');
const dialog = document.querySelector('#tile-dialog');
const form = document.querySelector('#tile-form');
const formError = document.querySelector('#form-error');
const backgroundColorInput = document.querySelector('#background-color');
const textColorInput = document.querySelector('#text-color');
const customColors = document.querySelector('#custom-colors');
const paletteChoices = document.querySelector('#palette-choices');
let tiles = [];
let editingId = null;
let selectedPalette = 'blue';

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeUrl(raw) {
  let value = raw.trim();
  if (!value) throw new Error('Enter a website address.');
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`;
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid website address.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use a website address that starts with http or https.');
  if (!url.hostname.includes('.')) throw new Error('Enter a full website address, such as example.com.');
  url.hash = '';
  url.username = '';
  url.password = '';
  return url.href.replace(/\/$/, '');
}

function isHex(value) {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

function sanitizeStoredTiles(stored) {
  if (!Array.isArray(stored)) return [];
  return stored.filter(tile => {
    try { return tile && ['http:', 'https:'].includes(new URL(tile.url).protocol); } catch { return false; }
  }).map(tile => ({
    ...tile,
    name: String(tile.name ?? ''),
    backgroundColor: isHex(tile.backgroundColor) ? tile.backgroundColor : undefined,
    textColor: isHex(tile.textColor) ? tile.textColor : undefined,
    color: isHex(tile.color) ? tile.color : undefined,
    openBehavior: tile.openBehavior === 'new-tab' ? 'new-tab' : 'same-tab'
  }));
}

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function faviconUrl(url) {
  const favicon = new URL(chrome.runtime.getURL('/_favicon/'));
  favicon.searchParams.set('pageUrl', url);
  favicon.searchParams.set('size', '64');
  return favicon.toString();
}

function makeTile({ url, name, paletteId = 'blue', backgroundColor, textColor, openBehavior = 'same-tab' }) {
  const palette = PALETTES.find(item => item.id === paletteId) || PALETTES.find(item => item.id === 'blue');
  return {
    id: makeId(), url, name: name || hostname(url),
    paletteId,
    backgroundColor: backgroundColor || palette.backgroundColor,
    textColor: textColor || palette.textColor,
    openBehavior
  };
}

function blendHex(foreground, background, amount) {
  const toChannels = hex => hex.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16));
  const from = toChannels(foreground);
  const into = toChannels(background);
  return `#${from.map((value, index) => Math.round(value * amount + into[index] * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

async function saveTiles() {
  await chrome.storage.local.set({ [STORAGE_KEY]: tiles });
  render();
}

function render() {
  grid.replaceChildren();
  const template = document.querySelector('#tile-template');
  tiles.forEach((tile, index) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.tile');
    const link = fragment.querySelector('.tile-link');
    const image = fragment.querySelector('img');
    const fallback = fragment.querySelector('.icon-fallback');
    const oldColor = !tile.backgroundColor && tile.color;
    card.style.setProperty('--tile-background', tile.backgroundColor || (oldColor ? blendHex(tile.color, '#202225', .23) : '#202225'));
    card.style.setProperty('--tile-text', tile.textColor || '#F1F2F4');
    link.href = tile.url;
    link.target = tile.openBehavior === 'new-tab' ? '_blank' : '_self';
    if (link.target === '_blank') link.rel = 'noopener noreferrer';
    fragment.querySelector('.tile-name').textContent = tile.name;
    fragment.querySelector('.tile-domain').textContent = hostname(tile.url);
    fragment.querySelector('.external-mark').hidden = tile.openBehavior !== 'new-tab';
    image.src = faviconUrl(tile.url);
    image.addEventListener('error', () => { image.hidden = true; fallback.textContent = Array.from(tile.name.trim())[0]?.toUpperCase() || '•'; fallback.style.display = 'block'; }, { once: true });
    image.addEventListener('load', () => { if (!image.naturalWidth) image.dispatchEvent(new Event('error')); }, { once: true });

    const edit = fragment.querySelector('.edit-tile');
    edit.addEventListener('click', () => openEditor(tile));
    const up = fragment.querySelector('.move-up');
    const down = fragment.querySelector('.move-down');
    up.disabled = index === 0;
    down.disabled = index === tiles.length - 1;
    if (up.disabled) up.style.opacity = '.3';
    if (down.disabled) down.style.opacity = '.3';
    up.addEventListener('click', () => moveTile(index, -1));
    down.addEventListener('click', () => moveTile(index, 1));
    grid.append(fragment);
  });

  const isEmpty = tiles.length === 0;
  emptyState.hidden = !isEmpty;
  grid.hidden = isEmpty;
  countLabel.textContent = isEmpty ? '' : `${tiles.length} of ${MAX_TILES} websites`;
  footerCount.textContent = `${tiles.length} / ${MAX_TILES} websites`;
  document.querySelector('#add-tile').disabled = tiles.length >= MAX_TILES;
  document.querySelector('#add-tile').title = tiles.length >= MAX_TILES ? 'You have reached the 15 website limit' : '';
}

async function moveTile(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= tiles.length) return;
  [tiles[index], tiles[target]] = [tiles[target], tiles[index]];
  await saveTiles();
}

function openEditor(tile = null) {
  if (!tile && tiles.length >= MAX_TILES) return;
  editingId = tile?.id ?? null;
  document.querySelector('#dialog-title').textContent = tile ? 'Edit website' : 'Add a website';
  document.querySelector('#site-name').value = tile?.name ?? '';
  document.querySelector('#site-url').value = tile?.url ?? '';
  selectedPalette = tile?.paletteId || (tile?.color ? 'custom' : 'blue');
  if (selectedPalette === 'custom') {
    backgroundColorInput.value = tile?.backgroundColor || (tile?.color ? blendHex(tile.color, '#202225', .23) : '#E1EEFF');
    textColorInput.value = tile?.textColor || (tile?.color ? '#F1F2F4' : '#1D4ED8');
  } else {
    const palette = PALETTES.find(item => item.id === selectedPalette) || PALETTES.find(item => item.id === 'blue');
    backgroundColorInput.value = tile?.backgroundColor || palette.backgroundColor;
    textColorInput.value = tile?.textColor || palette.textColor;
  }
  updateColorLabels();
  renderPaletteChoices();
  document.querySelector('#open-behavior').value = tile?.openBehavior ?? 'same-tab';
  document.querySelector('.save-button').textContent = tile ? 'Save changes' : 'Save website';
  document.querySelector('#remove-tile').hidden = !tile;
  formError.hidden = true;
  if (!dialog.open) dialog.showModal();
  setTimeout(() => document.querySelector('#site-url').focus(), 0);
}

function updateColorLabels() {
  document.querySelector('#background-color-value').textContent = backgroundColorInput.value.toUpperCase();
  document.querySelector('#text-color-value').textContent = textColorInput.value.toUpperCase();
}

function renderPaletteChoices() {
  paletteChoices.replaceChildren();
  const choices = [...PALETTES, { id: 'custom', name: 'Custom', backgroundColor: backgroundColorInput.value, textColor: textColorInput.value }];
  for (const choice of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'palette-choice';
    button.setAttribute('aria-pressed', String(selectedPalette === choice.id));
    button.innerHTML = `<span class="palette-swatch" aria-hidden="true"></span><span class="palette-name"></span>`;
    button.querySelector('.palette-swatch').style.background = `linear-gradient(135deg, ${choice.backgroundColor} 0 50%, ${choice.textColor} 50% 100%)`;
    button.querySelector('.palette-name').textContent = choice.name;
    button.addEventListener('click', () => {
      selectedPalette = choice.id;
      if (choice.id !== 'custom') {
        backgroundColorInput.value = choice.backgroundColor;
        textColorInput.value = choice.textColor;
      }
      customColors.hidden = selectedPalette !== 'custom';
      updateColorLabels();
      renderPaletteChoices();
    });
    paletteChoices.append(button);
  }
  customColors.hidden = selectedPalette !== 'custom';
}

function closeDialog() { if (dialog.open) dialog.close(); }

document.querySelector('#add-tile').addEventListener('click', () => openEditor());
document.querySelector('#empty-add').addEventListener('click', () => openEditor());
document.querySelector('#close-dialog').addEventListener('click', closeDialog);
document.querySelector('#cancel-dialog').addEventListener('click', closeDialog);
document.querySelector('#remove-tile').addEventListener('click', async () => {
  const tile = tiles.find(item => item.id === editingId);
  if (!tile) return;
  if (!confirm(`Remove ${tile.name} from your tiles?`)) return;
  tiles = tiles.filter(item => item.id !== editingId);
  await saveTiles();
  closeDialog();
});
backgroundColorInput.addEventListener('input', () => {
  selectedPalette = 'custom';
  updateColorLabels();
  renderPaletteChoices();
});
textColorInput.addEventListener('input', () => {
  selectedPalette = 'custom';
  updateColorLabels();
  renderPaletteChoices();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  formError.hidden = true;
  try {
    const url = normalizeUrl(document.querySelector('#site-url').value);
    const nameInput = document.querySelector('#site-name').value.trim();
    const name = nameInput || hostname(url);
    const duplicate = tiles.find(tile => tile.url.toLowerCase() === url.toLowerCase() && tile.id !== editingId);
    if (duplicate) throw new Error('That website is already on your page.');
    const next = {
      id: editingId ?? makeId(), url, name,
      paletteId: selectedPalette,
      backgroundColor: backgroundColorInput.value,
      textColor: textColorInput.value,
      openBehavior: document.querySelector('#open-behavior').value
    };
    if (editingId) tiles = tiles.map(tile => tile.id === editingId ? next : tile);
    else if (tiles.length < MAX_TILES) tiles.push(next);
    else throw new Error('You can add up to 15 websites. Remove one before adding another.');
    await saveTiles();
    closeDialog();
  } catch (error) {
    formError.textContent = error.message || 'Could not save this website.';
    formError.hidden = false;
  }
});

async function initialize() {
  const stored = await chrome.storage.local.get([STORAGE_KEY, INITIALIZED_KEY]);
  if (stored[INITIALIZED_KEY]) {
    tiles = sanitizeStoredTiles(stored[STORAGE_KEY]);
    render();
    return;
  }

  let starterTiles = [];
  try {
    const sites = await chrome.topSites.get();
    const seen = new Set();
    for (const site of sites) {
      if (starterTiles.length >= MAX_TILES) break;
      try {
        const url = normalizeUrl(site.url);
        if (seen.has(url.toLowerCase())) continue;
        seen.add(url.toLowerCase());
        const index = starterTiles.length;
        starterTiles.push(makeTile({
          url,
          name: site.title?.trim() || hostname(url),
          paletteId: PALETTES[index % PALETTES.length].id
        }));
      } catch {
        // Ignore a malformed entry and keep importing the remaining valid sites.
      }
    }
  } catch (error) {
    console.warn('Could not load the browser’s most-visited sites:', error);
  }
  tiles = starterTiles;
  await chrome.storage.local.set({ [STORAGE_KEY]: tiles, [INITIALIZED_KEY]: true });
  render();
}

initialize().catch(error => {
  console.error('Could not load saved websites:', error);
  grid.innerHTML = '<p class="load-error">Could not load your websites. Please reload this tab.</p>';
});
