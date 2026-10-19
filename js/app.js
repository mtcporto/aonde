/**
 * Aonde • Aplicação Principal (Galeria Curada por Perfil & Ocasião)
 */

import {
  IMG_BY_CATEGORY,
  ICONS,
  TYPE_META,
  TIERS_META,
  RESTAURANTS_DATA,
  HOTELS_DATA,
} from './data.js';

// ═════════════════════════════════════════════════════════════
//  APPLICATION STATE
// ═════════════════════════════════════════════════════════════
const urlParams = new URLSearchParams(window.location.search);
const initialTab = ['restaurantes', 'hoteis', 'favoritos'].includes(urlParams.get('tab'))
  ? urlParams.get('tab')
  : 'restaurantes';

const state = {
  tab: initialTab,
  tierFilter: 'all',
  categoryFilter: 'all',
  neighborhoodFilter: 'all',
  sortBy: 'curated',
  searchQuery: '',
  mapVisible: false,
  darkMode: localStorage.getItem('aonde_theme') !== 'light',
  favorites: new Set(JSON.parse(localStorage.getItem('aonde_favorites') || '[]')),
  amenities: {
    accessible: false,
    petFriendly: false,
    kidsSpace: false,
    parking: false,
    pool: false,
    wifi: false,
  },
};

let leafletMap = null;
let markersLayer = null;

// ═════════════════════════════════════════════════════════════
//  UTILITIES
// ═════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getItemKey(item, isHotel) {
  return `${isHotel ? 'h' : 'r'}-${item.id}`;
}

function getPriceWeight(priceStr) {
  return (priceStr || '').length || 2;
}

function getFallbackImageUrl(item, isHotel) {
  const cat = isHotel ? (item.imgCat || item.category) : item.type;
  return IMG_BY_CATEGORY[cat] || 'img/places/r-1.jpg';
}

function getImageUrl(item, isHotel) {
  return item.image || getFallbackImageUrl(item, isHotel);
}

function showToast(message) {
  const toast = document.getElementById('toast-notification');
  const text = document.getElementById('toast-message');
  if (!toast || !text) return;

  text.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 2400);
}

// ═════════════════════════════════════════════════════════════
//  THEME
// ═════════════════════════════════════════════════════════════
function applyTheme() {
  const root = document.documentElement;
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  if (state.darkMode) {
    root.classList.add('dark');
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
  } else {
    root.classList.remove('dark');
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
  }
}

function toggleTheme() {
  state.darkMode = !state.darkMode;
  localStorage.setItem('aonde_theme', state.darkMode ? 'dark' : 'light');
  applyTheme();
}

// ═════════════════════════════════════════════════════════════
//  FAVORITES
// ═════════════════════════════════════════════════════════════
function saveFavorites() {
  localStorage.setItem('aonde_favorites', JSON.stringify([...state.favorites]));
  updateTabCounts();
}

function toggleFavorite(key, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const added = !state.favorites.has(key);
  if (added) {
    state.favorites.add(key);
    showToast('Salvo na sua lista');
  } else {
    state.favorites.delete(key);
    showToast('Removido da lista');
  }

  saveFavorites();

  if (state.tab === 'favoritos') {
    renderAll();
  } else {
    document.querySelectorAll(`[data-fav-key="${key}"]`).forEach((btn) => {
      btn.classList.toggle('is-fav', added);
      btn.setAttribute('aria-label', added ? 'Remover dos salvos' : 'Salvar lugar');
    });
  }
}

function updateTabCounts() {
  const restCount = document.getElementById('rest-count');
  const hotelCount = document.getElementById('hotel-count');
  const favCount = document.getElementById('fav-count');
  const favCountMobile = document.getElementById('fav-count-mobile');

  if (restCount) restCount.textContent = RESTAURANTS_DATA.length;
  if (hotelCount) hotelCount.textContent = HOTELS_DATA.length;
  if (favCount) favCount.textContent = state.favorites.size;
  if (favCountMobile) favCountMobile.textContent = state.favorites.size;
}

// ═════════════════════════════════════════════════════════════
//  DROPDOWNS: PROFILE/TIER & NEIGHBORHOOD
// ═════════════════════════════════════════════════════════════
function getActiveDataset() {
  if (state.tab === 'restaurantes') return RESTAURANTS_DATA;
  if (state.tab === 'hoteis') return HOTELS_DATA;
  return [...RESTAURANTS_DATA, ...HOTELS_DATA];
}

function populateTierSelect() {
  const select = document.getElementById('tier-select');
  if (!select) return;

  const dataset = getActiveDataset();
  const counts = {};
  dataset.forEach((item) => {
    if (item.tier) counts[item.tier] = (counts[item.tier] || 0) + 1;
  });

  const tiers = Object.keys(counts).sort(
    (a, b) => (TIERS_META[a]?.order || 99) - (TIERS_META[b]?.order || 99)
  );
  const prev = state.tierFilter;

  select.innerHTML =
    `<option value="all">Todos os perfis (${dataset.length})</option>` +
    tiers
      .map((t) => {
        const meta = TIERS_META[t] || { title: t };
        return `<option value="${escapeHtml(t)}">${escapeHtml(meta.title)} (${counts[t]})</option>`;
      })
      .join('');

  if (tiers.includes(prev)) {
    select.value = prev;
  } else {
    state.tierFilter = 'all';
    select.value = 'all';
  }
}

function populateNeighborhoodSelect() {
  const select = document.getElementById('neighborhood-select');
  if (!select) return;

  const dataset = getActiveDataset();
  const counts = {};
  dataset.forEach((item) => {
    counts[item.neighborhood] = (counts[item.neighborhood] || 0) + 1;
  });

  const sorted = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const prev = state.neighborhoodFilter;

  select.innerHTML =
    `<option value="all">Todos os bairros (${dataset.length})</option>` +
    sorted.map((nb) => `<option value="${escapeHtml(nb)}">${escapeHtml(nb)} (${counts[nb]})</option>`).join('');

  if (sorted.includes(prev)) {
    select.value = prev;
  } else {
    state.neighborhoodFilter = 'all';
    select.value = 'all';
  }
}

function updateAmenityCounts() {
  const dataset = getActiveDataset();
  const amenityKeys = ['accessible', 'petFriendly', 'kidsSpace', 'pool', 'parking', 'wifi'];

  amenityKeys.forEach((key) => {
    const count = dataset.filter((item) => item.feat && item.feat[key] === true).length;
    const badge = document.querySelector(`[data-amenity-count="${key}"]`);
    if (badge) {
      badge.textContent = `(${count})`;
    }
  });
}

// ═════════════════════════════════════════════════════════════
//  FILTERING & GROUP MATCHING
// ═════════════════════════════════════════════════════════════
function matchesCategoryFilter(item, isHotel, filter) {
  if (filter === 'all') return true;
  if (isHotel) return item.category === filter;

  if (filter === 'cafe') return ['cafe', 'confeitaria'].includes(item.type);
  if (filter === 'bar') return ['bar', 'boteco'].includes(item.type);
  if (filter === 'churrasco') return ['churrasco', 'steakhouse'].includes(item.type);
  if (filter === 'oriental') return ['oriental', 'japonesa'].includes(item.type);
  if (filter === 'hamburgueria') return ['hamburgueria', 'lanches', 'fast-food'].includes(item.type);

  return item.type === filter;
}

function getFilteredItems() {
  let pool = [];

  if (state.tab === 'restaurantes') {
    pool = RESTAURANTS_DATA.map((item) => ({ item, isHotel: false }));
  } else if (state.tab === 'hoteis') {
    pool = HOTELS_DATA.map((item) => ({ item, isHotel: true }));
  } else {
    pool = [
      ...RESTAURANTS_DATA.map((item) => ({ item, isHotel: false })),
      ...HOTELS_DATA.map((item) => ({ item, isHotel: true })),
    ].filter(({ item, isHotel }) => state.favorites.has(getItemKey(item, isHotel)));
  }

  const q = normalizeStr(state.searchQuery);

  const filtered = pool.filter(({ item, isHotel }) => {
    if (state.tierFilter !== 'all' && item.tier !== state.tierFilter) {
      return false;
    }

    if (state.tab !== 'favoritos' && !matchesCategoryFilter(item, isHotel, state.categoryFilter)) {
      return false;
    }

    if (state.neighborhoodFilter !== 'all' && item.neighborhood !== state.neighborhoodFilter) {
      return false;
    }

    if (q) {
      const haystack = normalizeStr(
        `${item.name} ${isHotel ? item.categoryLabel : item.typeLabel} ${item.neighborhood} ${item.address || ''} ${item.description || ''}`
      );
      if (!haystack.includes(q)) return false;
    }

    if (state.amenities.accessible && item.feat.accessible !== true) return false;
    if (state.amenities.petFriendly && item.feat.petFriendly !== true) return false;
    if (state.amenities.parking && item.feat.parking !== true) return false;
    if (state.amenities.wifi && item.feat.wifi !== true) return false;
    if (!isHotel && state.amenities.kidsSpace && item.feat.kidsSpace !== true) return false;
    if (isHotel && state.amenities.pool && item.feat.pool !== true) return false;

    return true;
  });

  filtered.sort((a, b) => {
    if (state.sortBy === 'price-desc') {
      const diff = getPriceWeight(b.item.price) - getPriceWeight(a.item.price);
      if (diff !== 0) return diff;
    } else if (state.sortBy === 'price-asc') {
      const diff = getPriceWeight(a.item.price) - getPriceWeight(b.item.price);
      if (diff !== 0) return diff;
    } else if (state.sortBy === 'neighborhood') {
      const cmp = a.item.neighborhood.localeCompare(b.item.neighborhood, 'pt-BR');
      if (cmp !== 0) return cmp;
    } else if (state.sortBy === 'curated') {
      const orderA = TIERS_META[a.item.tier]?.order || 99;
      const orderB = TIERS_META[b.item.tier]?.order || 99;
      if (orderA !== orderB) return orderA - orderB;
      const priceDiff = getPriceWeight(b.item.price) - getPriceWeight(a.item.price);
      if (priceDiff !== 0) return priceDiff;
    }
    return a.item.name.localeCompare(b.item.name, 'pt-BR');
  });

  return filtered;
}

// ═════════════════════════════════════════════════════════════
//  MINIMALIST CARD RENDERING (CLEAN, LOW DENSITY)
// ═════════════════════════════════════════════════════════════
function renderMinimalCard({ item, isHotel }) {
  const key = getItemKey(item, isHotel);
  const isFav = state.favorites.has(key);
  const metaKey = isHotel ? item.category : item.type;
  const meta = TYPE_META[metaKey] || { icon: isHotel ? ICONS.hotel : ICONS.utensils };
  const imgSrc = getImageUrl(item, isHotel);
  const fallbackSrc = getFallbackImageUrl(item, isHotel);
  const categoryName = isHotel ? item.categoryLabel : item.typeLabel;
  const detailUrl = `detalhes.html?id=${encodeURIComponent(key)}`;

  return `
    <article class="minimal-card group relative flex flex-col">
      <a href="${detailUrl}" class="block focus:outline-none">
        <!-- Image Container -->
        <div class="relative aspect-[4/3] w-full rounded-3xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 mb-3.5 shadow-xs">
          <img src="${imgSrc}"
               alt="${escapeHtml(item.name)}"
               loading="lazy"
               referrerpolicy="no-referrer"
               class="card-photo w-full h-full object-cover"
               onerror="this.src='${fallbackSrc}';this.onerror=null" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 opacity-70 group-hover:opacity-90 transition-opacity"></div>

          <!-- Neighborhood Pill -->
          <span class="absolute bottom-3 left-3.5 text-[11px] font-semibold tracking-wide text-white bg-black/45 backdrop-blur-md px-3 py-1 rounded-full">
            ${escapeHtml(item.neighborhood)}
          </span>
        </div>

        <!-- Clean Typography Below Image -->
        <div class="px-1">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold text-[16px] text-neutral-900 dark:text-white group-hover:text-coral transition-colors truncate">
              ${escapeHtml(item.name)}
            </h3>
            <span class="text-neutral-400 group-hover:text-coral group-hover:translate-x-0.5 transition-all shrink-0">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </span>
          </div>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1.5 truncate">
            <span class="text-neutral-400 dark:text-neutral-500 shrink-0">${meta.icon}</span>
            <span class="truncate">${escapeHtml(categoryName)}</span>
            ${item.price ? `<span class="opacity-40">·</span><span class="font-semibold text-neutral-600 dark:text-neutral-300 shrink-0">${escapeHtml(item.price)}</span>` : ''}
          </p>
        </div>
      </a>

      <!-- Floating Favorite Heart -->
      <button type="button"
              data-fav-key="${key}"
              aria-label="${isFav ? 'Remover dos salvos' : 'Salvar lugar'}"
              class="fav-trigger ${isFav ? 'is-fav' : ''} absolute top-3 right-3 z-10 w-9 h-9 rounded-full
                     bg-white/85 dark:bg-neutral-900/85 backdrop-blur-md flex items-center justify-center
                     text-neutral-700 dark:text-neutral-200 hover:scale-110 transition shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </button>
    </article>
  `;
}

function renderCuratedSections(filtered) {
  const groups = new Map();
  filtered.forEach((entry) => {
    const tierKey = entry.item.tier || 'outros';
    if (!groups.has(tierKey)) groups.set(tierKey, []);
    groups.get(tierKey).push(entry);
  });

  const orderedTiers = [...groups.keys()].sort(
    (a, b) => (TIERS_META[a]?.order || 99) - (TIERS_META[b]?.order || 99)
  );

  return `
    <div class="space-y-16">
      ${orderedTiers
        .map((tierKey) => {
          const items = groups.get(tierKey);
          const meta = TIERS_META[tierKey] || {
            title: 'Selecionados',
            subtitle: '',
            badge: 'Curadoria',
          };

          return `
            <section class="curated-tier-section">
              <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-5 mb-7 border-b border-black/[0.07] dark:border-white/[0.08]">
                <div>
                  <div class="flex items-center gap-2.5 mb-1.5">
                    <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-coral bg-coral/10 px-2.5 py-0.5 rounded-full">
                      ${escapeHtml(meta.badge)}
                    </span>
                    <span class="text-xs font-medium text-neutral-400">
                      ${items.length} ${items.length === 1 ? 'lugar' : 'lugares'}
                    </span>
                  </div>
                  <h2 class="font-serif text-3xl sm:text-4xl text-neutral-900 dark:text-white tracking-tight leading-none">
                    ${escapeHtml(meta.title)}
                  </h2>
                </div>
                ${meta.subtitle ? `<p class="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md">${escapeHtml(meta.subtitle)}</p>` : ''}
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
                ${items.map(renderMinimalCard).join('')}
              </div>
            </section>
          `;
        })
        .join('')}
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════
//  INTERACTIVE MAP
// ═════════════════════════════════════════════════════════════
function initMapIfNeeded() {
  if (leafletMap || typeof L === 'undefined') return;

  leafletMap = L.map('map-canvas', {
    center: [-7.115, -34.828],
    zoom: 13,
    scrollWheelZoom: false,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(leafletMap);

  markersLayer = L.layerGroup().addTo(leafletMap);
}

function updateMapMarkers(filteredList) {
  if (!state.mapVisible) return;
  initMapIfNeeded();
  if (!leafletMap || !markersLayer) return;

  markersLayer.clearLayers();
  const bounds = [];

  filteredList.forEach(({ item, isHotel }) => {
    if (!item.lat || !item.lon) return;

    const key = getItemKey(item, isHotel);
    const metaKey = isHotel ? item.category : item.type;
    const meta = TYPE_META[metaKey] || { icon: isHotel ? ICONS.hotel : ICONS.utensils };
    const pinBg = isHotel ? '#0E7490' : '#E14D2A';

    const icon = L.divIcon({
      className: '',
      html: `<div class="custom-map-pin" style="background:${pinBg}"><span>${meta.icon}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });

    const marker = L.marker([item.lat, item.lon], { icon });
    marker.bindPopup(`
      <div class="p-2 min-w-[190px]">
        <p class="text-[10px] font-bold uppercase tracking-wider text-coral mb-0.5">
          ${escapeHtml(item.neighborhood)} ${item.price ? `· ${escapeHtml(item.price)}` : ''}
        </p>
        <h4 class="font-bold text-sm mb-1">${escapeHtml(item.name)}</h4>
        <p class="text-xs text-neutral-500 mb-2.5">${escapeHtml(isHotel ? item.categoryLabel : item.typeLabel)}</p>
        <a href="detalhes.html?id=${encodeURIComponent(key)}"
           class="inline-flex items-center justify-center gap-1.5 w-full text-center text-xs font-semibold bg-neutral-900 text-white py-2 px-3 rounded-xl hover:opacity-90 transition">
          <span>Abrir página</span>
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>
    `);

    markersLayer.addLayer(marker);
    bounds.push([item.lat, item.lon]);
  });

  setTimeout(() => {
    leafletMap.invalidateSize();
    if (bounds.length > 0) {
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, 80);
}

// ═════════════════════════════════════════════════════════════
//  RENDER ALL
// ═════════════════════════════════════════════════════════════
function renderAll() {
  const filtered = getFilteredItems();
  const grid = document.getElementById('places-grid');
  const emptyState = document.getElementById('empty-state');
  const emptySubtitle = document.getElementById('empty-subtitle');
  const resultsLabel = document.getElementById('results-label');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  if (!grid) return;

  if (state.sortBy === 'curated') {
    grid.className = '';
    grid.innerHTML = renderCuratedSections(filtered);
  } else {
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10';
    grid.innerHTML = filtered.map(renderMinimalCard).join('');
  }

  const hasActiveFilters =
    state.tierFilter !== 'all' ||
    state.categoryFilter !== 'all' ||
    state.neighborhoodFilter !== 'all' ||
    state.searchQuery !== '' ||
    Object.values(state.amenities).some(Boolean);

  clearFiltersBtn?.classList.toggle('hidden', !hasActiveFilters);

  if (filtered.length === 0) {
    grid.classList.add('hidden');
    emptyState?.classList.remove('hidden');
    if (emptySubtitle) {
      emptySubtitle.textContent =
        state.tab === 'favoritos' && state.favorites.size === 0
          ? 'Toque no ícone de coração nos cards para guardar seus lugares favoritos aqui.'
          : 'Experimente remover alguns filtros ou buscar por outro termo.';
    }
  } else {
    grid.classList.remove('hidden');
    emptyState?.classList.add('hidden');
  }

  if (resultsLabel) {
    resultsLabel.textContent = `${filtered.length} ${filtered.length === 1 ? 'lugar' : 'lugares'}`;
  }

  updateMapMarkers(filtered);
}

// ═════════════════════════════════════════════════════════════
//  NAVIGATION & EVENTS
// ═════════════════════════════════════════════════════════════
function setTab(newTab) {
  state.tab = newTab;
  state.tierFilter = 'all';
  state.categoryFilter = 'all';
  state.neighborhoodFilter = 'all';

  document.querySelectorAll('.seg-pill').forEach((btn) => {
    const active = btn.dataset.tab === newTab;
    btn.classList.toggle('active', active);
  });

  const restBar = document.getElementById('rest-filters');
  const hotelBar = document.getElementById('hotel-filters');
  const catWrapper = document.getElementById('category-bar-wrapper');

  if (newTab === 'restaurantes') {
    catWrapper?.classList.remove('hidden');
    restBar?.classList.remove('hidden');
    hotelBar?.classList.add('hidden');
  } else if (newTab === 'hoteis') {
    catWrapper?.classList.remove('hidden');
    restBar?.classList.add('hidden');
    hotelBar?.classList.remove('hidden');
  } else {
    catWrapper?.classList.add('hidden');
  }

  document.getElementById('pill-kids')?.classList.toggle('hidden', newTab === 'hoteis');
  document.getElementById('pill-pool')?.classList.toggle('hidden', newTab === 'restaurantes');

  document.querySelectorAll('.cat-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.filter === 'all');
  });

  populateTierSelect();
  populateNeighborhoodSelect();
  updateAmenityCounts();
  renderAll();
}

function resetAllFilters() {
  state.tierFilter = 'all';
  state.categoryFilter = 'all';
  state.neighborhoodFilter = 'all';
  state.searchQuery = '';
  Object.keys(state.amenities).forEach((k) => {
    state.amenities[k] = false;
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  document.getElementById('clear-search-btn')?.classList.add('hidden');

  const tierSelect = document.getElementById('tier-select');
  if (tierSelect) tierSelect.value = 'all';

  const nbSelect = document.getElementById('neighborhood-select');
  if (nbSelect) nbSelect.value = 'all';

  document.querySelectorAll('.cat-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.filter === 'all');
  });

  document.querySelectorAll('.amenity-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  renderAll();
}

function initEvents() {
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

  document.querySelectorAll('.seg-pill').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  document.querySelectorAll('.cat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.categoryFilter = chip.dataset.filter || 'all';
      const group = chip.closest('.filter-group');
      group?.querySelectorAll('.cat-chip').forEach((c) => c.classList.toggle('active', c === chip));
      renderAll();
    });
  });

  document.querySelectorAll('.amenity-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.amenity;
      if (!key) return;
      state.amenities[key] = !state.amenities[key];
      btn.classList.toggle('active', state.amenities[key]);
      renderAll();
    });
  });

  let searchTimer;
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  searchInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    clearSearchBtn?.classList.toggle('hidden', !val);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = val.trim();
      renderAll();
    }, 160);
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    state.searchQuery = '';
    renderAll();
  });

  document.getElementById('tier-select')?.addEventListener('change', (e) => {
    state.tierFilter = e.target.value;
    renderAll();
  });

  document.getElementById('neighborhood-select')?.addEventListener('change', (e) => {
    state.neighborhoodFilter = e.target.value;
    renderAll();
  });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderAll();
  });

  const mapToggleBtn = document.getElementById('map-toggle-btn');
  const mapSection = document.getElementById('map-section');
  mapToggleBtn?.addEventListener('click', () => {
    state.mapVisible = !state.mapVisible;
    mapSection?.classList.toggle('hidden', !state.mapVisible);
    mapToggleBtn.classList.toggle('bg-coral', state.mapVisible);
    mapToggleBtn.classList.toggle('text-white', state.mapVisible);
    mapToggleBtn.classList.toggle('border-coral', state.mapVisible);
    const span = mapToggleBtn.querySelector('span');
    if (span) span.textContent = state.mapVisible ? 'Fechar Mapa' : 'Mapa';
    if (state.mapVisible) updateMapMarkers(getFilteredItems());
  });

  document.getElementById('clear-filters-btn')?.addEventListener('click', resetAllFilters);
  document.getElementById('empty-reset-btn')?.addEventListener('click', resetAllFilters);

  document.getElementById('places-grid')?.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav-key]');
    if (favBtn) {
      toggleFavorite(favBtn.dataset.favKey, e);
    }
  });
}

async function hydrateFromTurso() {
  const endpoints = ['api/places.php', '/api/places'];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data?.items) || data.items.length === 0) continue;

      const restaurants = [];
      const hotels = [];
      for (const p of data.items) {
        const cleanImg = (p.image || '').replace(/^\/+/, '');
        if (p.kind === 'hotel') {
          hotels.push({
            id: Number(p.id),
            name: p.name,
            tier: p.tier,
            price: p.price,
            category: p.category || p.type,
            categoryLabel: p.categoryLabel || p.typeLabel,
            neighborhood: p.neighborhood,
            address: p.address,
            lat: Number(p.lat),
            lon: Number(p.lon),
            checkin: p.checkin || '14h',
            checkout: p.checkout || '12h',
            instagram: p.instagram || null,
            phone: p.phone || null,
            website: p.website || null,
            image: cleanImg,
            statusNote: p.statusNote || null,
            imgCat: p.category || p.type,
            description: p.description,
            feat: p.feat || {},
          });
        } else {
          restaurants.push({
            id: Number(p.id),
            name: p.name,
            tier: p.tier,
            price: p.price,
            type: p.type,
            typeLabel: p.typeLabel,
            neighborhood: p.neighborhood,
            address: p.address,
            lat: Number(p.lat),
            lon: Number(p.lon),
            hours: p.hours || '',
            instagram: p.instagram || null,
            phone: p.phone || null,
            website: p.website || null,
            image: cleanImg,
            statusNote: p.statusNote || null,
            description: p.description,
            feat: p.feat || {},
          });
        }
      }

      if (restaurants.length > 0) {
        RESTAURANTS_DATA.splice(0, RESTAURANTS_DATA.length, ...restaurants);
      }
      if (hotels.length > 0) {
        HOTELS_DATA.splice(0, HOTELS_DATA.length, ...hotels);
      }
      updateTabCounts();
      renderAll();
      return;
    } catch {
      // Try next endpoint or keep static fallback
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  updateTabCounts();
  setTab(state.tab);
  initEvents();
  hydrateFromTurso();
});

