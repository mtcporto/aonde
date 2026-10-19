"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PlaceItem } from "@/lib/db";
import { ICONS, TYPE_META, TIERS_META } from "@/js/data.js";

interface HomeClientProps {
  initialItems: PlaceItem[];
  source: "turso" | "fallback";
}

const RESTAURANT_CATEGORIES = [
  { key: "all", label: "Todas as culinárias", icon: "" },
  { key: "nordestino", label: "Nordestino", icon: (ICONS as any).sun },
  { key: "frutos-do-mar", label: "Frutos do Mar", icon: (ICONS as any).fish },
  { key: "alta-gastronomia", label: "Alta Gastronomia", icon: (ICONS as any).sparkles },
  { key: "italiana", label: "Italiana", icon: (ICONS as any).wine },
  { key: "cafe", label: "Cafés & Doces", icon: (ICONS as any).coffee },
  { key: "bar", label: "Bares & Botecos", icon: (ICONS as any).cocktail },
  { key: "churrasco", label: "Carnes & Grill", icon: (ICONS as any).flame },
  { key: "pizzaria", label: "Pizzas", icon: (ICONS as any).pizza },
  { key: "oriental", label: "Oriental", icon: (ICONS as any).bowl },
  { key: "hamburgueria", label: "Burgers & Lanches", icon: (ICONS as any).burger },
];

const HOTEL_CATEGORIES = [
  { key: "all", label: "Todos", icon: "" },
  { key: "hotel", label: "Hotéis", icon: (ICONS as any).hotel },
  { key: "hostel", label: "Hostels", icon: (ICONS as any).bed },
];

function normalizeStr(str: string) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getPriceWeight(priceStr: string) {
  return (priceStr || "$$").length || 2;
}

export default function HomeClient({ initialItems, source }: HomeClientProps) {
  const [tab, setTab] = useState<"restaurantes" | "hoteis" | "favoritos">("restaurantes");
  const [tierFilter, setTierFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("all");
  const [sortBy, setSortBy] = useState("curated");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapVisible, setMapVisible] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<Record<string, boolean>>({
    accessible: false,
    petFriendly: false,
    kidsSpace: false,
    parking: false,
    pool: false,
    wifi: false,
  });

  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("aonde_theme");
    const isDark = savedTheme !== "light";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    try {
      const savedFavs = JSON.parse(localStorage.getItem("aonde_favorites") || "[]");
      if (Array.isArray(savedFavs)) setFavorites(savedFavs);
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "restaurantes" || t === "hoteis" || t === "favoritos") {
      setTab(t);
    }
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("aonde_theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.clearTimeout((window as any).__toastTimer);
    (window as any).__toastTimer = window.setTimeout(() => {
      setToastMsg(null);
    }, 2400);
  };

  const toggleFavorite = (slugId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const exists = prev.includes(slugId);
      const next = exists ? prev.filter((k) => k !== slugId) : [...prev, slugId];
      localStorage.setItem("aonde_favorites", JSON.stringify(next));
      showToast(exists ? "Removido da lista" : "Salvo na sua lista");
      return next;
    });
  };

  const restaurants = useMemo(
    () => initialItems.filter((i) => i.kind === "restaurante"),
    [initialItems]
  );
  const hotels = useMemo(
    () => initialItems.filter((i) => i.kind === "hotel"),
    [initialItems]
  );

  const baseDataset = useMemo(() => {
    if (tab === "restaurantes") return restaurants;
    if (tab === "hoteis") return hotels;
    return initialItems.filter((i) => favorites.includes(i.slugId));
  }, [tab, restaurants, hotels, initialItems, favorites]);

  const availableTiers = useMemo(() => {
    const tierOrder =
      tab === "hoteis"
        ? ["hoteis-orla", "economicos-hostels"]
        : ["experiencias", "tradicionais", "bares", "cafes", "almoco-pratico", "lanches"];
    return tierOrder.filter((t) => baseDataset.some((i) => i.tier === t));
  }, [tab, baseDataset]);

  const availableNeighborhoods = useMemo(() => {
    const set = new Set<string>();
    baseDataset.forEach((i) => {
      if (i.neighborhood) set.add(i.neighborhood);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [baseDataset]);

  const matchCategory = (item: PlaceItem, cat: string) => {
    if (cat === "all") return true;
    if (item.kind === "hotel") return item.type === cat || item.category === cat;
    if (cat === "cafe") return item.type === "cafe" || item.type === "confeitaria";
    if (cat === "bar") return item.type === "bar" || item.type === "boteco";
    if (cat === "churrasco") return item.type === "churrasco" || item.type === "steakhouse";
    if (cat === "oriental") return item.type === "oriental" || item.type === "japonesa";
    if (cat === "hamburgueria")
      return item.type === "hamburgueria" || item.type === "lanches" || item.type === "fast-food";
    return item.type === cat;
  };

  const preAmenityFiltered = useMemo(() => {
    const q = normalizeStr(searchQuery);
    return baseDataset.filter((item) => {
      if (tierFilter !== "all" && item.tier !== tierFilter) return false;
      if (!matchCategory(item, categoryFilter)) return false;
      if (neighborhoodFilter !== "all" && item.neighborhood !== neighborhoodFilter) return false;
      if (q) {
        const hay = normalizeStr(
          `${item.name} ${item.typeLabel} ${item.neighborhood} ${item.address} ${item.description}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [baseDataset, tierFilter, categoryFilter, neighborhoodFilter, searchQuery]);

  const filteredItems = useMemo(() => {
    const activeAmenities = Object.entries(amenities)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const list = preAmenityFiltered.filter((item) =>
      activeAmenities.every((am) => Boolean((item.feat as any)?.[am]))
    );

    const sorted = [...list];
    if (sortBy === "price-desc") {
      sorted.sort(
        (a, b) =>
          getPriceWeight(b.price) - getPriceWeight(a.price) ||
          a.name.localeCompare(b.name, "pt-BR")
      );
    } else if (sortBy === "price-asc") {
      sorted.sort(
        (a, b) =>
          getPriceWeight(a.price) - getPriceWeight(b.price) ||
          a.name.localeCompare(b.name, "pt-BR")
      );
    } else if (sortBy === "neighborhood") {
      sorted.sort(
        (a, b) =>
          a.neighborhood.localeCompare(b.neighborhood, "pt-BR") ||
          a.name.localeCompare(b.name, "pt-BR")
      );
    } else if (sortBy === "curated") {
      sorted.sort((a, b) => {
        const orderA = (TIERS_META as any)[a.tier]?.order || 99;
        const orderB = (TIERS_META as any)[b.tier]?.order || 99;
        if (orderA !== orderB) return orderA - orderB;
        const priceDiff = getPriceWeight(b.price) - getPriceWeight(a.price);
        if (priceDiff !== 0) return priceDiff;
        return a.name.localeCompare(b.name, "pt-BR");
      });
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    return sorted;
  }, [preAmenityFiltered, amenities, sortBy]);

  const amenityCounts = useMemo(() => {
    const activeKeys = Object.entries(amenities)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const counts: Record<string, number> = {};
    for (const key of ["accessible", "petFriendly", "kidsSpace", "pool", "parking", "wifi"]) {
      const otherActive = activeKeys.filter((k) => k !== key);
      counts[key] = preAmenityFiltered.filter(
        (item) =>
          Boolean((item.feat as any)?.[key]) &&
          otherActive.every((am) => Boolean((item.feat as any)?.[am]))
      ).length;
    }
    return counts;
  }, [preAmenityFiltered, amenities]);

  useEffect(() => {
    if (!mapVisible) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current) {
      mapRef.current = L.map("map-canvas", {
        center: [-7.115, -34.828],
        zoom: 13,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
      markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const layer = markersLayerRef.current;
    layer.clearLayers();
    const bounds: [number, number][] = [];

    filteredItems.forEach((item) => {
      if (!item.lat || !item.lon) return;
      const isHotel = item.kind === "hotel";
      const meta = (TYPE_META as any)[item.type] || { icon: (ICONS as any).utensils };
      const pinBg = isHotel ? "#0E7490" : "#E14D2A";
      const icon = L.divIcon({
        className: "",
        html: `<div class="custom-map-pin" style="background:${pinBg}"><span>${meta.icon}</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });
      const marker = L.marker([item.lat, item.lon], { icon });
      marker.bindPopup(`
        <div class="p-3">
          <p class="text-[10px] font-bold uppercase tracking-wider text-coral mb-0.5">${item.typeLabel}</p>
          <p class="font-bold text-sm text-neutral-900 dark:text-white mb-1">${item.name}</p>
          <p class="text-xs text-neutral-500 mb-2">${item.neighborhood} · ${item.price}</p>
          <a href="/detalhes?id=${item.slugId}" class="text-xs font-semibold text-coral hover:underline">Ver detalhes →</a>
        </div>
      `);
      layer.addLayer(marker);
      bounds.push([item.lat, item.lon]);
    });

    setTimeout(() => {
      mapRef.current?.invalidateSize();
      if (bounds.length > 0) {
        mapRef.current?.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
      }
    }, 100);
  }, [mapVisible, filteredItems]);

  const hasActiveFilters =
    tierFilter !== "all" ||
    categoryFilter !== "all" ||
    neighborhoodFilter !== "all" ||
    searchQuery.trim() !== "" ||
    Object.values(amenities).some(Boolean);

  const resetAllFilters = () => {
    setTierFilter("all");
    setCategoryFilter("all");
    setNeighborhoodFilter("all");
    setSearchQuery("");
    setAmenities({
      accessible: false,
      petFriendly: false,
      kidsSpace: false,
      parking: false,
      pool: false,
      wifi: false,
    });
  };

  const renderCard = (item: PlaceItem) => {
    const isFav = favorites.includes(item.slugId);
    const meta = (TYPE_META as any)[item.type] || {
      icon: item.kind === "hotel" ? (ICONS as any).hotel : (ICONS as any).utensils,
      label: item.typeLabel,
    };

    return (
      <article key={item.slugId} className="minimal-card group relative flex flex-col">
        <a href={`/detalhes?id=${item.slugId}`} className="block focus:outline-none">
          <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 mb-3.5 shadow-sm">
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              className="card-photo w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 opacity-70 group-hover:opacity-90 transition-opacity" />

            <span className="absolute bottom-3 left-3.5 text-[11px] font-semibold tracking-wide text-white bg-black/45 backdrop-blur-md px-3 py-1 rounded-full">
              {item.neighborhood}
            </span>
          </div>

          <div className="px-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-[16px] text-neutral-900 dark:text-white group-hover:text-coral transition-colors truncate">
                {item.name}
              </h3>
              <span className="text-neutral-400 group-hover:text-coral group-hover:translate-x-0.5 transition-all shrink-0">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1.5 truncate">
              <span
                className="text-neutral-400 dark:text-neutral-500 shrink-0"
                dangerouslySetInnerHTML={{ __html: meta.icon }}
              />
              <span className="truncate">{item.typeLabel}</span>
              {item.price && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="font-semibold text-neutral-600 dark:text-neutral-300 shrink-0">
                    {item.price}
                  </span>
                </>
              )}
            </p>
          </div>
        </a>

        <button
          type="button"
          onClick={(e) => toggleFavorite(item.slugId, e)}
          aria-label={isFav ? "Remover dos salvos" : "Salvar lugar"}
          className={`fav-trigger ${
            isFav ? "is-fav" : ""
          } absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/85 dark:bg-neutral-900/85 backdrop-blur-md flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:scale-110 transition shadow-sm`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>
      </article>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#F6F5F2]/85 dark:bg-[#0B0D11]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-coral text-white flex items-center justify-center font-serif italic text-2xl shadow-sm group-hover:scale-105 transition">
              a
            </div>
            <div>
              <span className="font-serif text-3xl tracking-tight text-neutral-900 dark:text-white leading-none block">
                Aonde
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 block mt-0.5">
                João Pessoa · PB
              </span>
            </div>
          </a>

          <nav className="hidden md:flex items-center p-1.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800/80 border border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setTab("restaurantes");
                setTierFilter("all");
                setCategoryFilter("all");
              }}
              className={`seg-pill ${
                tab === "restaurantes" ? "active" : "text-neutral-600 dark:text-neutral-300"
              } px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2`}
            >
              <span>Gastronomia</span>
              <span className="opacity-60 font-normal">{restaurants.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("hoteis");
                setTierFilter("all");
                setCategoryFilter("all");
              }}
              className={`seg-pill ${
                tab === "hoteis" ? "active" : "text-neutral-600 dark:text-neutral-300"
              } px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2`}
            >
              <span>Hospedagem</span>
              <span className="opacity-60 font-normal">{hotels.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("favoritos");
                setTierFilter("all");
                setCategoryFilter("all");
              }}
              className={`seg-pill ${
                tab === "favoritos" ? "active" : "text-neutral-600 dark:text-neutral-300"
              } px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2`}
            >
              <span>Salvos</span>
              <span className="px-1.5 py-0.5 rounded-full bg-coral/15 text-coral text-[11px] font-bold">
                {favorites.length}
              </span>
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMapVisible((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border transition shadow-sm ${
                mapVisible
                  ? "bg-coral text-white border-coral"
                  : "bg-white dark:bg-neutral-900 border-neutral-200/90 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-coral"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
                <path d="M15 5.764v15" />
                <path d="M9 3.236v15" />
              </svg>
              <span>{mapVisible ? "Fechar Mapa" : "Mapa"}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:border-coral transition"
              aria-label="Alternar tema"
            >
              {darkMode ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="md:hidden px-4 pb-3 flex justify-center">
          <div className="inline-flex w-full max-w-sm p-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800/80">
            <button
              type="button"
              onClick={() => {
                setTab("restaurantes");
                setTierFilter("all");
                setCategoryFilter("all");
              }}
              className={`seg-pill ${
                tab === "restaurantes" ? "active" : "text-neutral-600 dark:text-neutral-300"
              } flex-1 py-2 rounded-full text-xs font-semibold text-center`}
            >
              Gastronomia
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("hoteis");
                setTierFilter("all");
                setCategoryFilter("all");
              }}
              className={`seg-pill ${
                tab === "hoteis" ? "active" : "text-neutral-600 dark:text-neutral-300"
              } flex-1 py-2 rounded-full text-xs font-semibold text-center`}
            >
              Hospedagem
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("favoritos");
                setTierFilter("all");
                setCategoryFilter("all");
              }}
              className={`seg-pill ${
                tab === "favoritos" ? "active" : "text-neutral-600 dark:text-neutral-300"
              } flex-1 py-2 rounded-full text-xs font-semibold text-center`}
            >
              Salvos ({favorites.length})
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-10 pb-6">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-8">
          <div className="lg:col-span-7">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-coral mb-3">
              Guia de bolso · Litoral Paraibano
            </p>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-neutral-900 dark:text-white leading-[0.98] tracking-tight">
              Descubra os melhores sabores &amp; refúgios de{" "}
              <span className="italic font-normal text-coral">Jampa.</span>
            </h1>
          </div>
          <div className="lg:col-span-5">
            <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Uma seleção enxuta de {initialItems.length} lugares entre cafés botânicos, mesas à
              beira-mar, botecos autênticos e hotéis charmosos de Tambaú ao Bessa.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#14171F] p-2.5 rounded-3xl shadow-sm border border-black/[0.06] dark:border-white/[0.07] flex flex-col md:flex-row items-stretch md:items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <svg
              className="absolute left-4 text-neutral-400 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, culinária ou bairro…"
              className="w-full pl-11 pr-9 py-3 rounded-2xl bg-transparent text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-white flex items-center justify-center transition"
                aria-label="Limpar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="hidden md:block w-px h-7 bg-neutral-200 dark:bg-neutral-800" />

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-2">
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              aria-label="Perfil ou Ocasião"
              className="w-full sm:w-auto text-xs font-semibold bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200 rounded-2xl px-4 py-3 focus:outline-none cursor-pointer border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 transition"
            >
              <option value="all">Todos os perfis</option>
              {availableTiers.map((t) => (
                <option key={t} value={t}>
                  {(TIERS_META as any)[t]?.title || t}
                </option>
              ))}
            </select>

            <select
              value={neighborhoodFilter}
              onChange={(e) => setNeighborhoodFilter(e.target.value)}
              aria-label="Bairro"
              className="w-full sm:w-auto text-xs font-semibold bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200 rounded-2xl px-4 py-3 focus:outline-none cursor-pointer border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 transition"
            >
              <option value="all">Todos os bairros</option>
              {availableNeighborhoods.map((nb) => (
                <option key={nb} value={nb}>
                  {nb}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Ordenar"
              className="w-full sm:w-auto text-xs font-semibold bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200 rounded-2xl px-4 py-3 focus:outline-none cursor-pointer border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 transition"
            >
              <option value="curated">Por Perfil &amp; Ocasião</option>
              <option value="price-desc">Preço: $$$$ → $</option>
              <option value="price-asc">Preço: $ → $$$$</option>
              <option value="name-asc">Ordem A–Z</option>
              <option value="neighborhood">Por Bairro</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {tab !== "favoritos" && (
            <div className="filter-group no-scrollbar flex items-center gap-2 py-1">
              {(tab === "hoteis" ? HOTEL_CATEGORIES : RESTAURANT_CATEGORIES).map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`cat-chip ${
                    categoryFilter === cat.key ? "active" : ""
                  } inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full bg-white dark:bg-[#14171F] border border-black/[0.07] dark:border-white/[0.08] whitespace-nowrap`}
                >
                  {cat.icon && <span dangerouslySetInnerHTML={{ __html: cat.icon }} />}
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mr-1">
                Comodidades:
              </span>
              {[
                { key: "accessible", label: "Acessível", icon: (ICONS as any).accessible, show: true },
                { key: "petFriendly", label: "Pet Friendly", icon: (ICONS as any).paw, show: true },
                { key: "kidsSpace", label: "Espaço Kids", icon: (ICONS as any).kids, show: tab !== "hoteis" },
                { key: "pool", label: "Piscina", icon: (ICONS as any).pool, show: tab === "hoteis" },
                { key: "parking", label: "Estacionamento", icon: (ICONS as any).parking, show: true },
                { key: "wifi", label: "Wi-Fi", icon: (ICONS as any).wifi, show: true },
              ]
                .filter((a) => a.show)
                .map((am) => (
                  <button
                    key={am.key}
                    type="button"
                    onClick={() =>
                      setAmenities((prev) => ({ ...prev, [am.key]: !prev[am.key] }))
                    }
                    className={`amenity-btn ${
                      amenities[am.key] ? "active" : ""
                    } inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 whitespace-nowrap`}
                  >
                    <span dangerouslySetInnerHTML={{ __html: am.icon }} />
                    <span>{am.label}</span>
                    <span className="opacity-55 text-[11px]">({amenityCounts[am.key] ?? 0})</span>
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-4 ml-auto">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-semibold text-coral hover:underline"
                >
                  Limpar filtros
                </button>
              )}
              <p className="text-xs font-medium text-neutral-400">
                {filteredItems.length}{" "}
                {filteredItems.length === 1 ? "lugar encontrado" : "lugares encontrados"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 pb-20 flex-1">
        {mapVisible && (
          <section className="mb-10">
            <div className="rounded-3xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] shadow-xl bg-white dark:bg-[#14171F]">
              <div id="map-canvas" />
            </div>
          </section>
        )}

        {filteredItems.length === 0 ? (
          <div className="text-center py-24 px-4">
            <p className="font-serif italic text-4xl text-neutral-400 mb-2">
              Nenhum lugar encontrado
            </p>
            <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">
              Experimente remover alguns filtros ou buscar por outro termo.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-5 py-2.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold"
            >
              Redefinir busca
            </button>
          </div>
        ) : sortBy === "curated" && tierFilter === "all" && tab !== "favoritos" ? (
          <div className="space-y-16">
            {availableTiers.map((tierKey) => {
              const group = filteredItems.filter((i) => i.tier === tierKey);
              if (group.length === 0) return null;
              const meta = (TIERS_META as any)[tierKey] || {
                title: tierKey,
                subtitle: "",
                badge: "Curadoria",
              };
              return (
                <section key={tierKey} className="curated-tier-section">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-5 mb-7 border-b border-black/[0.07] dark:border-white/[0.08]">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        {meta.badge && (
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-coral bg-coral/10 px-2.5 py-0.5 rounded-full">
                            {meta.badge}
                          </span>
                        )}
                        <span className="text-xs font-medium text-neutral-400">
                          {group.length} {group.length === 1 ? "lugar" : "lugares"}
                        </span>
                      </div>
                      <h2 className="font-serif text-3xl sm:text-4xl text-neutral-900 dark:text-white tracking-tight leading-none">
                        {meta.title}
                      </h2>
                    </div>
                    {meta.subtitle && (
                      <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
                        {meta.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
                    {group.map(renderCard)}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
            {filteredItems.map(renderCard)}
          </div>
        )}
      </main>

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
          <div className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2.5 rounded-full shadow-xl text-xs font-semibold">
            {toastMsg}
          </div>
        </div>
      )}

      <footer className="border-t border-black/[0.06] dark:border-white/[0.07] py-10 px-4 sm:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-xl text-neutral-800 dark:text-neutral-200">
              Aonde
            </span>
            <span>· Curadoria independente de João Pessoa, Paraíba</span>
          </div>
          <div>
            Dados cartográficos{" "}
            <a
              href="https://www.openstreetmap.org"
              target="_blank"
              rel="noopener"
              className="underline hover:text-coral"
            >
              OpenStreetMap
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
