/**
 * Aonde • Página de Detalhes (detalhes.html)
 */

import {
  IMG_BY_CATEGORY,
  ICONS,
  TYPE_META,
  TIERS_META,
  FEATURES_META,
  RESTAURANTS_DATA,
  HOTELS_DATA,
} from './data.js';

let darkMode = localStorage.getItem('aonde_theme') !== 'light';
const favorites = new Set(JSON.parse(localStorage.getItem('aonde_favorites') || '[]'));

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getFallbackImageUrl(item, isHotel) {
  const cat = isHotel ? (item.imgCat || item.category) : item.type;
  return IMG_BY_CATEGORY[cat] || 'img/places/r-1.jpg';
}

function getImageUrl(item, isHotel) {
  return item.image || getFallbackImageUrl(item, isHotel);
}

function getGoogleMapsUrl(item) {
  const query = `${item.name}, ${item.address || item.neighborhood}, João Pessoa - PB`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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

function applyTheme() {
  const root = document.documentElement;
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  if (darkMode) {
    root.classList.add('dark');
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
  } else {
    root.classList.remove('dark');
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
  }
}

function updateFavButtonUI(key) {
  const isFav = favorites.has(key);
  const btn = document.getElementById('detail-fav-btn');
  const label = document.getElementById('detail-fav-label');
  if (btn) btn.classList.toggle('is-fav', isFav);
  if (label) label.textContent = isFav ? 'Salvo' : 'Salvar';
}

function renderDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('id') || '';
  const [prefix, rawId] = key.split('-');
  const id = Number(rawId);
  const isHotel = prefix === 'h';

  const dataset = isHotel ? HOTELS_DATA : RESTAURANTS_DATA;
  const item = dataset.find((x) => x.id === id);
  const root = document.getElementById('detail-root');
  if (!root) return;

  const backLink = document.getElementById('back-link');
  if (backLink) {
    backLink.href = isHotel ? 'index.html?tab=hoteis' : 'index.html?tab=restaurantes';
  }

  if (!item) {
    root.innerHTML = `
      <div class="text-center py-24">
        <h1 class="font-serif italic text-5xl text-neutral-400 mb-3">Local não encontrado</h1>
        <p class="text-sm text-neutral-500 mb-6">O endereço que você acessou não corresponde a um local cadastrado.</p>
        <a href="index.html" class="inline-block px-6 py-3 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold">
          Voltar para a página inicial
        </a>
      </div>
    `;
    return;
  }

  document.title = `${item.name} — Aonde João Pessoa`;
  updateFavButtonUI(key);

  const metaKey = isHotel ? item.category : item.type;
  const meta = TYPE_META[metaKey] || { icon: isHotel ? ICONS.hotel : ICONS.utensils };
  const tierMeta = TIERS_META[item.tier];
  const categoryName = isHotel ? item.categoryLabel : item.typeLabel;
  const imgSrc = getImageUrl(item, isHotel);
  const fallbackSrc = getFallbackImageUrl(item, isHotel);
  const gmapsUrl = getGoogleMapsUrl(item);
  const instaClean = item.instagram ? item.instagram.replace('@', '') : null;

  const activeFeatures = Object.entries(item.feat)
    .filter(([, val]) => val === true)
    .map(([k]) => FEATURES_META[k])
    .filter(Boolean);

  // Related places (prioritize same tier/profile first, then neighborhood/category)
  const related = dataset
    .filter((x) => x.id !== item.id && (x.tier === item.tier || x.neighborhood === item.neighborhood))
    .sort((a, b) => {
      const aSameTier = a.tier === item.tier ? 0 : 1;
      const bSameTier = b.tier === item.tier ? 0 : 1;
      if (aSameTier !== bSameTier) return aSameTier - bSameTier;
      const aSameNb = a.neighborhood === item.neighborhood ? 0 : 1;
      const bSameNb = b.neighborhood === item.neighborhood ? 0 : 1;
      return aSameNb - bSameNb;
    })
    .slice(0, 4);

  root.innerHTML = `
    <!-- Breadcrumb & Header -->
    <div class="mb-6">
      <div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-coral mb-2">
        <span class="inline-flex items-center gap-1.5">${meta.icon} <span>${escapeHtml(categoryName)}</span></span>
        ${tierMeta ? `<span class="opacity-40">·</span><span class="text-neutral-500 dark:text-neutral-400">${escapeHtml(tierMeta.badge)}</span>` : ''}
        ${item.price ? `<span class="opacity-40">·</span><span class="text-neutral-600 dark:text-neutral-300">${escapeHtml(item.price)}</span>` : ''}
        <span class="opacity-40">·</span>
        <span>${escapeHtml(item.neighborhood)}</span>
      </div>
      <h1 class="font-serif text-4xl sm:text-6xl text-neutral-900 dark:text-white leading-[1.02] tracking-tight">
        ${escapeHtml(item.name)}
      </h1>
    </div>

    <!-- Hero Cover Photo -->
    <div class="relative aspect-[16/9] sm:aspect-[21/9] w-full rounded-3xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 mb-10 shadow-sm">
      <img src="${imgSrc}"
           alt="${escapeHtml(item.name)}"
           referrerpolicy="no-referrer"
           class="w-full h-full object-cover"
           onerror="this.src='${fallbackSrc}';this.onerror=null" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
    </div>

    <!-- Two Column Editorial Content -->
    <div class="grid lg:grid-cols-12 gap-10 items-start">

      <!-- Left Column: About, Status Note, Amenities, Map -->
      <div class="lg:col-span-7 space-y-10">
        <!-- About -->
        <section>
          <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3">Sobre o lugar</h2>
          <p class="text-base sm:text-lg text-neutral-700 dark:text-neutral-300 leading-relaxed">
            ${escapeHtml(item.description || 'Um dos lugares selecionados pela curadoria Aonde em João Pessoa.')}
          </p>

          ${item.statusNote ? `
            <div class="mt-4 p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
              ${escapeHtml(item.statusNote)}
            </div>
          ` : ''}
        </section>

        <!-- Amenities -->
        ${activeFeatures.length ? `
          <section class="pt-8 border-t border-black/[0.06] dark:border-white/[0.07]">
            <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-4">Comodidades &amp; Estrutura</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              ${activeFeatures.map((f) => `
                <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#14171F] border border-black/[0.06] dark:border-white/[0.07]">
                  <span class="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 text-coral flex items-center justify-center shrink-0">
                    ${f.icon}
                  </span>
                  <span class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">${escapeHtml(f.label)}</span>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Embedded Map -->
        <section class="pt-8 border-t border-black/[0.06] dark:border-white/[0.07]">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Localização em ${escapeHtml(item.neighborhood)}</h2>
            <span class="text-xs text-neutral-500">${escapeHtml(item.address)}</span>
          </div>
          <div class="rounded-3xl overflow-hidden border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#14171F]">
            <div id="detail-map-canvas"></div>
          </div>
        </section>
      </div>

      <!-- Right Column: Sticky Practical Info Card -->
      <aside class="lg:col-span-5 lg:sticky lg:top-28">
        <div class="bg-white dark:bg-[#14171F] rounded-3xl p-6 sm:p-7 border border-black/[0.07] dark:border-white/[0.08] shadow-sm space-y-5">
          <div class="flex items-start gap-3.5">
            <span class="w-9 h-9 rounded-2xl bg-neutral-100 dark:bg-neutral-800/90 text-coral flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div>
              <p class="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Endereço Verificado</p>
              <p class="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">
                ${escapeHtml(item.address)}
              </p>
              <p class="text-xs text-neutral-500 mt-0.5">${escapeHtml(item.neighborhood)} · João Pessoa, PB</p>
            </div>
          </div>

          <div class="pt-4 border-t border-black/[0.06] dark:border-white/[0.07] flex items-start gap-3.5">
            <span class="w-9 h-9 rounded-2xl bg-neutral-100 dark:bg-neutral-800/90 text-coral flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <div>
              <p class="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
                ${isHotel ? 'Horários de Hospedagem' : 'Funcionamento'}
              </p>
              <p class="text-sm font-semibold text-neutral-900 dark:text-white">
                ${isHotel ? `Check-in: ${escapeHtml(item.checkin)} · Check-out: ${escapeHtml(item.checkout)}` : escapeHtml(item.hours || 'Consulte o perfil oficial')}
              </p>
            </div>
          </div>

          ${item.phone ? `
            <div class="pt-4 border-t border-black/[0.06] dark:border-white/[0.07] flex items-start gap-3.5">
              <span class="w-9 h-9 rounded-2xl bg-neutral-100 dark:bg-neutral-800/90 text-coral flex items-center justify-center shrink-0 mt-0.5">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              <div>
                <p class="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Telefone / WhatsApp</p>
                <p class="text-sm font-semibold text-neutral-900 dark:text-white">
                  ${escapeHtml(item.phone)}
                </p>
              </div>
            </div>
          ` : ''}

          ${(instaClean || item.website) ? `
            <div class="pt-4 border-t border-black/[0.06] dark:border-white/[0.07] flex flex-wrap gap-6">
              ${instaClean ? `
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Instagram</p>
                  <a href="https://instagram.com/${encodeURIComponent(instaClean)}" target="_blank" rel="noopener noreferrer"
                     class="text-sm font-semibold text-coral hover:underline inline-flex items-center gap-1.5">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                    <span>${escapeHtml(item.instagram)}</span>
                    <svg class="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                  </a>
                </div>
              ` : ''}

              ${item.website ? `
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Site Oficial</p>
                  <a href="${escapeHtml(item.website)}" target="_blank" rel="noopener noreferrer"
                     class="text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-coral hover:underline inline-flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                    <span>${escapeHtml(item.website.replace(/^https?:\/\//, ''))}</span>
                    <svg class="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                  </a>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div class="pt-3 space-y-2.5">
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer"
               class="w-full py-3.5 px-5 rounded-2xl bg-coral hover:opacity-95 text-white font-semibold text-xs uppercase tracking-wider
                      flex items-center justify-center gap-2 transition shadow-sm">
              <span>Traçar rota no Google Maps</span>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
            </a>

            <div class="grid grid-cols-2 gap-2.5">
              <button type="button" id="copy-addr-btn"
                      class="py-3 px-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700
                             text-neutral-800 dark:text-neutral-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition">
                <svg class="w-3.5 h-3.5 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                <span>Copiar endereço</span>
              </button>
              <button type="button" id="share-place-btn"
                      class="py-3 px-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700
                             text-neutral-800 dark:text-neutral-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition">
                <svg class="w-3.5 h-3.5 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
                <span>Compartilhar</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Related Places -->
    ${related.length ? `
      <section class="mt-20 pt-12 border-t border-black/[0.06] dark:border-white/[0.07]">
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-serif text-3xl text-neutral-900 dark:text-white">
            Explore também por perto
          </h2>
          <a href="${isHotel ? 'index.html?tab=hoteis' : 'index.html?tab=restaurantes'}"
             class="inline-flex items-center gap-1.5 text-xs font-semibold text-coral hover:underline">
            <span>Ver todos</span>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          ${related.map((rel) => {
            const relKey = `${isHotel ? 'h' : 'r'}-${rel.id}`;
            const relImg = getImageUrl(rel, isHotel);
            const relFallback = getFallbackImageUrl(rel, isHotel);
            const relCat = isHotel ? rel.categoryLabel : rel.typeLabel;
            const relMetaKey = isHotel ? rel.category : rel.type;
            const relMeta = TYPE_META[relMetaKey] || { icon: isHotel ? ICONS.hotel : ICONS.utensils };
            return `
              <a href="detalhes.html?id=${encodeURIComponent(relKey)}" class="minimal-card group block">
                <div class="relative aspect-[4/3] rounded-3xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 mb-3">
                  <img src="${relImg}" alt="${escapeHtml(rel.name)}" loading="lazy" referrerpolicy="no-referrer" class="card-photo w-full h-full object-cover" onerror="this.src='${relFallback}';this.onerror=null" />
                  <span class="absolute bottom-3 left-3 text-[11px] font-semibold text-white bg-black/45 backdrop-blur-md px-3 py-1 rounded-full">
                    ${escapeHtml(rel.neighborhood)}
                  </span>
                </div>
                <h3 class="font-semibold text-sm text-neutral-900 dark:text-white group-hover:text-coral transition-colors truncate">
                  ${escapeHtml(rel.name)}
                </h3>
                <p class="text-xs text-neutral-500 mt-1 flex items-center gap-1.5 truncate">
                  <span class="text-neutral-400 dark:text-neutral-500 shrink-0">${relMeta.icon}</span>
                  <span class="truncate">${escapeHtml(relCat)}</span>
                </p>
              </a>
            `;
          }).join('')}
        </div>
      </section>
    ` : ''}
  `;

  // Initialize Single Place Map
  if (item.lat && item.lon && typeof L !== 'undefined') {
    const map = L.map('detail-map-canvas', {
      center: [item.lat, item.lon],
      zoom: 16,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const pinBg = isHotel ? '#0E7490' : '#E14D2A';
    const icon = L.divIcon({
      className: '',
      html: `<div class="custom-map-pin" style="background:${pinBg}"><span>${meta.icon}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    L.marker([item.lat, item.lon], { icon }).addTo(map);
  }

  // Detail Buttons
  document.getElementById('copy-addr-btn')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(`${item.name} — ${item.address}, ${item.neighborhood}, João Pessoa - PB`);
    showToast('Endereço copiado!');
  });

  document.getElementById('share-place-btn')?.addEventListener('click', async () => {
    const shareData = {
      title: `${item.name} — Aonde João Pessoa`,
      text: `Confira ${item.name} (${item.neighborhood}) no guia Aonde João Pessoa:`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('Link da página copiado!');
    }
  });

  document.getElementById('detail-fav-btn')?.addEventListener('click', () => {
    if (favorites.has(key)) {
      favorites.delete(key);
      showToast('Removido dos salvos');
    } else {
      favorites.add(key);
      showToast('Salvo na sua lista');
    }
    localStorage.setItem('aonde_favorites', JSON.stringify([...favorites]));
    updateFavButtonUI(key);
  });
}

async function hydrateDetailFromTurso() {
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
      renderDetailPage();
      return;
    } catch {
      // Fallback to local static data
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    darkMode = !darkMode;
    localStorage.setItem('aonde_theme', darkMode ? 'dark' : 'light');
    applyTheme();
  });
  renderDetailPage();
  hydrateDetailFromTurso();
});

