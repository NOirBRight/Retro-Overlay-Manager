const storageKey = 'retro-overlay-manager::overlays';

const machineCatalog = [
  { id: 'snes', name: 'SNES', aspect: '4:3' },
  { id: 'n64', name: 'Nintendo 64', aspect: '4:3' },
  { id: 'gba', name: 'Game Boy Advance', aspect: '3:2' },
  { id: 'ps1', name: 'PlayStation', aspect: '4:3' },
  { id: 'ps2', name: 'PlayStation 2', aspect: '16:9 / 4:3' },
  { id: 'arcade', name: 'Arcade', aspect: '4:3' },
  { id: 'dreamcast', name: 'Dreamcast', aspect: '4:3' },
  { id: 'widescreen', name: 'General widescreen', aspect: '16:9' },
];

const dom = {
  form: document.querySelector('#overlay-form'),
  grid: document.querySelector('#overlay-grid'),
  empty: document.querySelector('#empty-state'),
  template: document.querySelector('#overlay-card-template'),
  filterMachine: document.querySelector('#filter-machine'),
  filterSearch: document.querySelector('#filter-search'),
  filterSort: document.querySelector('#filter-sort'),
  seedButton: document.querySelector('#seed-button'),
  bulkActions: document.querySelector('#bulk-actions'),
  selectionCount: document.querySelector('#selection-count'),
  bulkDownload: document.querySelector('#bulk-download'),
  bulkEdit: document.querySelector('#bulk-edit'),
  bulkDelete: document.querySelector('#bulk-delete'),
  bulkClear: document.querySelector('#bulk-clear'),
  machineOptions: document.querySelector('#machine-options'),
  editMachineOptions: document.querySelector('#edit-machine-options'),
  bulkMachineOptions: document.querySelector('#bulk-machine-options'),
  editDialog: document.querySelector('#edit-dialog'),
  bulkDialog: document.querySelector('#bulk-dialog'),
  editForm: document.querySelector('#edit-form'),
  bulkForm: document.querySelector('#bulk-form'),
};

const selection = new Set();
let editTargetId = null;

const demoOverlays = [
  {
    name: 'Arcade Neo Noir',
    machines: ['arcade'],
    description: 'High-contrast bezel with transparent CRT mask, tuned for 4:3 cabinets.',
    overlayFile: 'arcade-neo-noir.png',
    color: '#161925',
  },
  {
    name: 'N64 Night Drive',
    machines: ['n64', 'widescreen'],
    description: 'Wide-screen overlay with subtle vignette and controller hints.',
    overlayFile: 'n64-night-drive.png',
    color: '#0e1825',
  },
  {
    name: 'SNES Pastel Glass',
    machines: ['snes'],
    description: 'Soft pastel scanlines with acrylic frame; best at 5x scale.',
    overlayFile: 'snes-pastel-glass.png',
    color: '#1a1722',
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

function machineLabel(id) {
  return machineCatalog.find((m) => m.id === id)?.name || id;
}

function machineAspect(id) {
  return machineCatalog.find((m) => m.id === id)?.aspect || 'N/A';
}

function renderMachineOptions(container, namePrefix, selected = []) {
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  machineCatalog.forEach((machine) => {
    const label = document.createElement('label');
    label.className = 'chip-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = `${namePrefix}-${machine.id}`;
    input.value = machine.id;
    input.checked = selected.includes(machine.id);
    const span = document.createElement('span');
    span.innerHTML = `<strong>${machine.name}</strong> <small>${machine.aspect}</small>`;
    label.append(input, span);
    fragment.appendChild(label);
  });
  container.appendChild(fragment);
}

function getSelectedMachines(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function createOverlayCard(data) {
  const card = dom.template.content.firstElementChild.cloneNode(true);
  const title = card.querySelector('.overlay-card__title');
  const desc = card.querySelector('.overlay-card__description');
  const emulator = card.querySelector('.overlay-card__emulator');
  const meta = card.querySelector('.overlay-card__meta');
  const badge = card.querySelector('.badge');
  const img = card.querySelector('img');
  const machineTags = card.querySelector('.machine-tags');
  const selectBox = card.querySelector('[data-select]');

  title.textContent = data.name;
  desc.textContent = data.description;
  emulator.textContent = data.machines.map(machineLabel).join(', ');
  meta.textContent = `${data.overlayFile} · Added ${formatDate(new Date(data.createdAt))}`;
  badge.dataset.badge = data.isDemo ? 'demo' : 'new';
  badge.textContent = data.isDemo ? 'DEMO' : 'NEW';

  if (data.previewDataUrl) {
    img.src = data.previewDataUrl;
  } else {
    img.src = data.overlayDataUrl;
  }

  machineTags.innerHTML = '';
  data.machines.forEach((id) => {
    const tag = document.createElement('span');
    tag.className = 'machine-tag';
    tag.textContent = `${machineLabel(id)} • ${machineAspect(id)}`;
    machineTags.appendChild(tag);
  });

  selectBox.checked = selection.has(data.id);

  card.dataset.id = data.id;
  card.querySelector('[data-action="download"]').addEventListener('click', () => handleDownload(data));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => handleDelete(data.id));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditDialog(data.id));
  selectBox.addEventListener('change', (event) => toggleSelection(data.id, event.target.checked));

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
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function normalizeFileName(file) {
  return file?.name || file || 'overlay.png';
}

async function handleSubmit(event) {
  event.preventDefault();
  const overlayMachines = getSelectedMachines(dom.machineOptions);
  if (!overlayMachines.length) {
    alert('Please choose at least one supported system.');
    return;
  }

  const formData = new FormData(dom.form);
  const overlayFile = formData.get('overlayFile');
  const previewFile = formData.get('previewFile');

  const overlayDataUrl = await readFileAsDataUrl(overlayFile);
  const previewDataUrl = previewFile ? await readFileAsDataUrl(previewFile) : overlayDataUrl;

  const overlays = loadOverlays();
  overlays.unshift({
    id: crypto.randomUUID(),
    name: formData.get('name'),
    machines: overlayMachines,
    description: formData.get('description'),
    overlayFile: normalizeFileName(overlayFile),
    overlayDataUrl,
    previewDataUrl,
    createdAt: new Date().toISOString(),
    isDemo: false,
  });

  saveOverlays(overlays);
  dom.form.reset();
  renderMachineOptions(dom.machineOptions, 'create');
  applyFilters();
}

function handleDownload(overlay) {
  downloadBlob(dataUrlToBlob(overlay.overlayDataUrl), overlay.overlayFile);
}

function handleDelete(id) {
  const overlays = loadOverlays().filter((item) => item.id !== id);
  selection.delete(id);
  saveOverlays(overlays);
  applyFilters();
  updateSelectionUI();
}

function applyFilters() {
  const overlays = loadOverlays();
  const machine = dom.filterMachine.value;
  const search = dom.filterSearch.value.toLowerCase().trim();
  const sort = dom.filterSort.value;

  let filtered = overlays.filter((overlay) => {
    const matchMachine = machine === 'all' || overlay.machines.includes(machine);
    const matchSearch =
      !search ||
      overlay.name.toLowerCase().includes(search) ||
      overlay.description.toLowerCase().includes(search) ||
      overlay.machines.some((id) => machineLabel(id).toLowerCase().includes(search));
    return matchMachine && matchSearch;
  });

  filtered = filtered.sort((a, b) => {
    if (sort === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  renderOverlays(filtered);
  updateSelectionUI();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, content] = dataUrl.split(',');
  const mime = meta.match(/data:(.*);base64/)[1];
  const binary = atob(content);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toggleSelection(id, isSelected) {
  if (isSelected) {
    selection.add(id);
  } else {
    selection.delete(id);
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = selection.size;
  dom.selectionCount.textContent = count;
  dom.bulkActions.hidden = count === 0;
  if (count === 0) return;
  dom.grid.querySelectorAll('[data-select]').forEach((checkbox) => {
    const cardId = checkbox.closest('.overlay-card')?.dataset.id;
    checkbox.checked = selection.has(cardId);
  });
}

async function handleBulkDownload() {
  if (!selection.size) return;
  const overlays = loadOverlays().filter((overlay) => selection.has(overlay.id));
  const zip = new JSZip();

  await Promise.all(
    overlays.map(async (overlay) => {
      const blob = dataUrlToBlob(overlay.overlayDataUrl);
      zip.file(overlay.overlayFile, blob);
    })
  );

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, 'overlays.zip');
}

function handleBulkDelete() {
  if (!selection.size) return;
  const overlays = loadOverlays().filter((overlay) => !selection.has(overlay.id));
  selection.clear();
  saveOverlays(overlays);
  applyFilters();
  updateSelectionUI();
}

function clearSelection() {
  selection.clear();
  updateSelectionUI();
}

function openEditDialog(id) {
  editTargetId = id;
  const overlays = loadOverlays();
  const target = overlays.find((overlay) => overlay.id === id);
  if (!target) return;

  dom.editForm.name.value = target.name;
  dom.editForm.description.value = target.description;
  renderMachineOptions(dom.editMachineOptions, 'edit', target.machines);
  dom.editDialog.showModal();
}

function openBulkDialog() {
  if (!selection.size) return;
  dom.bulkForm.name.value = '';
  renderMachineOptions(dom.bulkMachineOptions, 'bulk', []);
  dom.bulkDialog.showModal();
}

function handleEditSubmit(event) {
  event.preventDefault();
  const machines = getSelectedMachines(dom.editMachineOptions);
  if (!machines.length) {
    alert('Please choose at least one supported system.');
    return;
  }

  const overlays = loadOverlays();
  const index = overlays.findIndex((item) => item.id === editTargetId);
  if (index === -1) return;

  overlays[index] = {
    ...overlays[index],
    name: dom.editForm.name.value,
    description: dom.editForm.description.value,
    machines,
  };

  saveOverlays(overlays);
  applyFilters();
  dom.editDialog.close();
}

function handleBulkSubmit(event) {
  event.preventDefault();
  const name = dom.bulkForm.name.value.trim();
  const machines = getSelectedMachines(dom.bulkMachineOptions);
  const overlays = loadOverlays();

  const updated = overlays.map((overlay) => {
    if (!selection.has(overlay.id)) return overlay;
    return {
      ...overlay,
      name: name || overlay.name,
      machines: machines.length ? machines : overlay.machines,
    };
  });

  saveOverlays(updated);
  applyFilters();
  dom.bulkDialog.close();
}

function seedDemoData() {
  const now = new Date().toISOString();
  const overlays = demoOverlays.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    machines: item.machines,
    description: item.description,
    overlayFile: item.overlayFile,
    overlayDataUrl: createDemoImage(item.name, item.color),
    previewDataUrl: createDemoImage(item.name, item.color),
    createdAt: now,
    isDemo: true,
  }));

  saveOverlays([...overlays, ...loadOverlays()]);
  applyFilters();
}

function createDemoImage(text, color) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">
    <rect width="800" height="500" fill="${color}" />
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#7ae4f7" font-size="32" font-family="Inter, sans-serif">${text}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function populateMachineFilter() {
  machineCatalog.forEach((machine) => {
    const option = document.createElement('option');
    option.value = machine.id;
    option.textContent = `${machine.name} (${machine.aspect})`;
    dom.filterMachine.appendChild(option);
  });
}

function initMachineFields() {
  renderMachineOptions(dom.machineOptions, 'create');
  renderMachineOptions(dom.editMachineOptions, 'edit');
  renderMachineOptions(dom.bulkMachineOptions, 'bulk');
  populateMachineFilter();
}

function initDialogs() {
  dom.editDialog.addEventListener('click', (event) => {
    if (event.target.dataset.close !== undefined || event.target === dom.editDialog) {
      dom.editDialog.close();
    }
  });
  dom.bulkDialog.addEventListener('click', (event) => {
    if (event.target.dataset.close !== undefined || event.target === dom.bulkDialog) {
      dom.bulkDialog.close();
    }
  });
}

function init() {
  initMachineFields();
  initDialogs();

  dom.form.addEventListener('submit', handleSubmit);
  dom.filterMachine.addEventListener('change', applyFilters);
  dom.filterSearch.addEventListener('input', applyFilters);
  dom.filterSort.addEventListener('change', applyFilters);
  dom.seedButton.addEventListener('click', seedDemoData);
  dom.bulkDownload.addEventListener('click', handleBulkDownload);
  dom.bulkDelete.addEventListener('click', handleBulkDelete);
  dom.bulkClear.addEventListener('click', clearSelection);
  dom.bulkEdit.addEventListener('click', openBulkDialog);
  dom.editForm.addEventListener('submit', handleEditSubmit);
  dom.bulkForm.addEventListener('submit', handleBulkSubmit);

  const overlays = loadOverlays();
  if (!overlays.length) {
    dom.empty.hidden = false;
  } else {
    applyFilters();
  }
}

init();
