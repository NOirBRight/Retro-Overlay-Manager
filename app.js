const storageKey = 'retro-overlay-manager::overlays';

const dom = {
  form: document.querySelector('#overlay-form'),
  grid: document.querySelector('#overlay-grid'),
  empty: document.querySelector('#empty-state'),
  template: document.querySelector('#overlay-card-template'),
  filterEmulator: document.querySelector('#filter-emulator'),
  filterSearch: document.querySelector('#filter-search'),
  filterSort: document.querySelector('#filter-sort'),
  seedButton: document.querySelector('#seed-button'),
};

const demoOverlays = [
  {
    name: 'Arcade Neo Noir',
    emulator: 'MAME',
    description: 'High-contrast bezel with transparent CRT mask, tuned for 4:3 cabinets.',
    overlayText: 'Arcade-Neo-Noir.cfg',
    previewColor: '#161925',
  },
  {
    name: 'PS2 Night Drive',
    emulator: 'PCSX2',
    description: 'Wide-screen overlay with subtle vignette and controller hints.',
    overlayText: 'night-drive-overlay.ini',
    previewColor: '#0e1825',
  },
  {
    name: 'SNES Pastel Glass',
    emulator: 'BSNES',
    description: 'Soft pastel scanlines with acrylic frame; best at 5x scale.',
    overlayText: 'pastel-glass.json',
    previewColor: '#1a1722',
  },
];

function loadOverlays() {
  const value = localStorage.getItem(storageKey);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse overlays', err);
    return [];
  }
}

function saveOverlays(overlays) {
  localStorage.setItem(storageKey, JSON.stringify(overlays));
}

function createOverlayCard(data) {
  const card = dom.template.content.firstElementChild.cloneNode(true);
  const title = card.querySelector('.overlay-card__title');
  const desc = card.querySelector('.overlay-card__description');
  const emulator = card.querySelector('.overlay-card__emulator');
  const meta = card.querySelector('.overlay-card__meta');
  const badge = card.querySelector('.badge');
  const img = card.querySelector('img');

  title.textContent = data.name;
  desc.textContent = data.description;
  emulator.textContent = data.emulator;
  meta.textContent = `${data.overlayFile} · Added ${data.createdAt}`;
  badge.dataset.badge = data.isDemo ? 'demo' : 'new';
  badge.textContent = data.isDemo ? 'DEMO' : 'NEW';

  if (data.previewDataUrl) {
    img.src = data.previewDataUrl;
  } else {
    img.src = `https://dummyimage.com/600x400/0e1017/7ae4f7&text=${encodeURIComponent(data.emulator)}`;
  }

  card.dataset.id = data.id;
  card.querySelector('[data-action="download"]').addEventListener('click', () => handleDownload(data));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => handleDelete(data.id));

  return card;
}

function renderOverlays(overlays) {
  dom.grid.innerHTML = '';
  const fragment = document.createDocumentFragment();
  overlays.forEach((overlay) => fragment.appendChild(createOverlayCard(overlay)));
  dom.grid.appendChild(fragment);
  dom.empty.hidden = overlays.length > 0;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function normalizeFileName(file) {
  return file?.name || file || 'overlay';
}

async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(dom.form);
  const overlayFile = formData.get('overlayFile');
  const previewFile = formData.get('previewFile');

  const [overlayDataUrl, previewDataUrl] = await Promise.all([
    readFileAsDataUrl(overlayFile),
    previewFile ? readFileAsDataUrl(previewFile) : Promise.resolve(null),
  ]);

  const overlays = loadOverlays();
  overlays.unshift({
    id: crypto.randomUUID(),
    name: formData.get('name'),
    emulator: formData.get('emulator'),
    description: formData.get('description'),
    overlayFile: normalizeFileName(overlayFile),
    overlayDataUrl,
    previewDataUrl,
    createdAt: formatDate(new Date()),
    isDemo: false,
  });

  saveOverlays(overlays);
  applyFilters();
  dom.form.reset();
}

function handleDownload(overlay) {
  const a = document.createElement('a');
  a.href = overlay.overlayDataUrl;
  a.download = overlay.overlayFile;
  a.click();
}

function handleDelete(id) {
  const overlays = loadOverlays().filter((item) => item.id !== id);
  saveOverlays(overlays);
  applyFilters();
}

function applyFilters() {
  const overlays = loadOverlays();
  const emulator = dom.filterEmulator.value;
  const search = dom.filterSearch.value.toLowerCase().trim();
  const sort = dom.filterSort.value;

  let filtered = overlays.filter((overlay) => {
    const matchEmulator = emulator === 'all' || overlay.emulator === emulator;
    const matchSearch = !search || overlay.name.toLowerCase().includes(search) || overlay.description.toLowerCase().includes(search);
    return matchEmulator && matchSearch;
  });

  filtered = filtered.sort((a, b) => {
    if (sort === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  renderOverlays(filtered);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function seedDemoData() {
  const overlays = demoOverlays.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    emulator: item.emulator,
    description: item.description,
    overlayFile: item.overlayText,
    overlayDataUrl: `data:text/plain,${encodeURIComponent(item.overlayText)}`,
    previewDataUrl: `https://dummyimage.com/600x400/${item.previewColor.replace('#', '')}/7ae4f7&text=${encodeURIComponent(item.name)}`,
    createdAt: formatDate(new Date()),
    isDemo: true,
  }));

  saveOverlays([...overlays, ...loadOverlays()]);
  applyFilters();
}

function init() {
  dom.form.addEventListener('submit', handleSubmit);
  dom.filterEmulator.addEventListener('change', applyFilters);
  dom.filterSearch.addEventListener('input', applyFilters);
  dom.filterSort.addEventListener('change', applyFilters);
  dom.seedButton.addEventListener('click', seedDemoData);

  if (!loadOverlays().length) {
    dom.empty.hidden = false;
  } else {
    applyFilters();
  }
}

init();
