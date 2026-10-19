"use client";

import React, { useEffect, useState } from "react";
import type { PlaceItem } from "@/lib/db";
import { ICONS, TYPE_META, TIERS_META, FEATURES_META } from "@/js/data.js";

interface DetailClientProps {
  place: PlaceItem | null;
  related: PlaceItem[];
  source: "turso" | "fallback";
}

export default function DetailClient({ place, related, source }: DetailClientProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("aonde_theme");
    const isDark = savedTheme !== "light";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    try {
      const savedFavs = JSON.parse(localStorage.getItem("aonde_favorites") || "[]");
      if (Array.isArray(savedFavs)) setFavorites(savedFavs);
    } catch {}
  }, []);

  useEffect(() => {
    if (!place || !place.lat || !place.lon) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById("detail-map-canvas");
    if (!container) return;
    if ((container as any)._leaflet_id) return;

    const map = L.map("detail-map-canvas", {
      center: [place.lat, place.lon],
      zoom: 16,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const isHotel = place.kind === "hotel";
    const meta = (TYPE_META as any)[place.type] || { icon: (ICONS as any).utensils };
    const pinBg = isHotel ? "#0E7490" : "#E14D2A";
    const icon = L.divIcon({
      className: "",
      html: `<div class="custom-map-pin" style="background:${pinBg}"><span>${meta.icon}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });
    L.marker([place.lat, place.lon], { icon }).addTo(map);

    return () => {
      map.remove();
    };
  }, [place]);

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

  const isFav = place ? favorites.includes(place.slugId) : false;

  const toggleFav = () => {
    if (!place) return;
    setFavorites((prev) => {
      const exists = prev.includes(place.slugId);
      const next = exists
        ? prev.filter((k) => k !== place.slugId)
        : [...prev, place.slugId];
      localStorage.setItem("aonde_favorites", JSON.stringify(next));
      showToast(exists ? "Removido dos salvos" : "Salvo na sua lista");
      return next;
    });
  };

  if (!place) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="font-serif italic text-5xl text-neutral-400 mb-3">
          Local não encontrado
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          O endereço que você acessou não corresponde a um local cadastrado no banco Turso.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-coral text-white text-xs font-semibold"
        >
          Voltar ao guia
        </a>
      </div>
    );
  }

  const isHotel = place.kind === "hotel";
  const meta = (TYPE_META as any)[place.type] || { icon: (ICONS as any).utensils };
  const tierMeta = (TIERS_META as any)[place.tier];
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.name}, ${place.address || place.neighborhood}, João Pessoa - PB`
  )}`;

  const featureEntries = Object.entries(FEATURES_META as Record<string, { icon: string; label: string }>).filter(
    ([key]) => {
      if (key === "pool" && !isHotel) return false;
      if (key === "kidsSpace" && isHotel) return false;
      return true;
    }
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#F6F5F2]/85 dark:bg-[#0B0D11]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <a
            href={isHotel ? "/?tab=hoteis" : "/?tab=restaurantes"}
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 px-4 py-2.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 hover:border-coral transition"
          >
            <span>← Voltar ao guia</span>
          </a>

          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-coral text-white flex items-center justify-center font-serif italic text-xl">
              a
            </div>
            <span className="font-serif text-2xl tracking-tight text-neutral-900 dark:text-white">
              Aonde
            </span>
          </a>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleFav}
              className={`fav-trigger ${isFav ? "is-fav" : ""} inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:border-coral transition`}
            >
              <span>{isFav ? "♥ Salvo" : "♡ Salvar"}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:border-coral transition"
              aria-label="Alternar tema"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8 pb-20 flex-1">
        <div className="relative rounded-3xl overflow-hidden h-[340px] sm:h-[440px] mb-10 border border-black/[0.08] dark:border-white/[0.08] shadow-xl">
          <img
            src={place.image}
            alt={place.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 text-white">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="glass-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                <span dangerouslySetInnerHTML={{ __html: meta.icon }} />
                <span>{place.typeLabel}</span>
              </span>
              {tierMeta?.title && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-md">
                  {tierMeta.title}
                </span>
              )}
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-coral text-white">
                {place.price}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-black/45 backdrop-blur-md">
                {place.neighborhood}
              </span>
            </div>
            <h1 className="font-serif text-4xl sm:text-6xl leading-none tracking-tight">
              {place.name}
            </h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-white dark:bg-[#14171F] rounded-3xl p-6 sm:p-8 border border-black/[0.06] dark:border-white/[0.07]">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-coral mb-3">
                Sobre o local
              </h2>
              <p className="text-base sm:text-lg text-neutral-700 dark:text-neutral-200 leading-relaxed">
                {place.description}
              </p>
              {place.statusNote && (
                <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-300">
                  <strong>Nota:</strong> {place.statusNote}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-[#14171F] rounded-3xl p-6 sm:p-8 border border-black/[0.06] dark:border-white/[0.07]">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-4">
                Comodidades &amp; Estrutura
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {featureEntries.map(([key, fMeta]) => {
                  const active = Boolean((place.feat as any)?.[key]);
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs font-semibold ${
                        active
                          ? "border-emerald-500/30 bg-emerald-500/5 text-neutral-900 dark:text-white"
                          : "border-neutral-200/60 dark:border-neutral-800/60 text-neutral-400 opacity-50"
                      }`}
                    >
                      <span dangerouslySetInnerHTML={{ __html: fMeta.icon }} />
                      <span>{fMeta.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white dark:bg-[#14171F] rounded-3xl p-4 border border-black/[0.06] dark:border-white/[0.07]">
              <div
                id="detail-map-canvas"
                className="rounded-2xl overflow-hidden"
                style={{ height: 300 }}
              />
            </section>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <aside className="bg-white dark:bg-[#14171F] rounded-3xl p-6 sm:p-8 border border-black/[0.06] dark:border-white/[0.07] space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                  Informações &amp; Contato
                </h2>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {source === "turso" ? "Turso DB" : "Local"}
                </span>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Endereço</p>
                  <p className="font-medium text-neutral-900 dark:text-white">
                    {place.address}
                  </p>
                  <p className="text-xs text-neutral-500">{place.neighborhood} · João Pessoa, PB</p>
                </div>

                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">
                    {isHotel ? "Check-in / Check-out" : "Horário de funcionamento"}
                  </p>
                  <p className="font-medium text-neutral-900 dark:text-white">{place.hours}</p>
                </div>

                {place.phone && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-0.5">Telefone / Contato</p>
                    <p className="font-medium text-neutral-900 dark:text-white">{place.phone}</p>
                  </div>
                )}

                {place.instagram && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-0.5">Instagram</p>
                    <a
                      href={`https://instagram.com/${place.instagram.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-coral hover:underline"
                    >
                      {place.instagram}
                    </a>
                  </div>
                )}

                {place.website && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-0.5">Site Oficial</p>
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-coral hover:underline break-all"
                    >
                      {place.website}
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.07] flex flex-col gap-2.5">
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-2xl bg-coral text-white text-xs font-semibold text-center hover:opacity-95 transition"
                >
                  Abrir no Google Maps ↗
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `${place.name} — ${place.address}, ${place.neighborhood}, João Pessoa - PB`
                    );
                    showToast("Endereço copiado!");
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-semibold hover:border-coral transition"
                >
                  Copiar endereço
                </button>
              </div>
            </aside>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-14 pt-10 border-t border-black/[0.06] dark:border-white/[0.07]">
            <h2 className="font-serif text-3xl text-neutral-900 dark:text-white mb-6">
              Explore também por perto
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {related.map((rel) => {
                const relMeta = (TYPE_META as any)[rel.type] || {
                  icon: (ICONS as any).utensils,
                };
                return (
                  <a
                    key={rel.slugId}
                    href={`/detalhes?id=${rel.slugId}`}
                    className="group bg-white dark:bg-[#14171F] rounded-3xl p-3.5 border border-black/[0.06] dark:border-white/[0.07] hover:border-coral transition block"
                  >
                    <div className="relative h-40 rounded-2xl overflow-hidden mb-3">
                      <img
                        src={rel.image}
                        alt={rel.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/65 text-white">
                        {rel.price}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-neutral-900 dark:text-white group-hover:text-coral transition-colors truncate">
                      {rel.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5 truncate">
                      <span
                        className="text-neutral-400 shrink-0"
                        dangerouslySetInnerHTML={{ __html: relMeta.icon }}
                      />
                      <span className="truncate">
                        {rel.typeLabel} · {rel.neighborhood}
                      </span>
                    </p>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
          <div className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2.5 rounded-full shadow-xl text-xs font-semibold">
            {toastMsg}
          </div>
        </div>
      )}
    </>
  );
}
