"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ExternalLink, Save, Check, Loader2, Star } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface PostMetadata {
  id?: string;
  post_id: string;
  // VISUEL
  outfit: string | null;
  backdrop: string | null;
  lighting: string | null;
  shot_type: string | null;
  duration_seconds: number | null;
  contrast_level: string | null;
  // HOOK
  hook_type: string | null;
  hook_description: string | null;
  // CONTENU
  content_description: string | null;
  energy_level: string | null;
  editing_pace: string | null;
  // AUDIO
  music_name: string | null;
  audio_type: string | null;
  // TEST & NOTES
  tested_variable: string | null;
  notes: string | null;
}

export interface PostForPanel {
  id: string;
  shortcode: string;
  post_type: string;
  url: string;
  caption: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  video_duration?: number | null; // durée Apify en secondes — pré-remplit duration_seconds
  latest_snapshot: {
    likes_count: number | null;
    comments_count: number | null;
    views_count: number | null;
    plays_count: number | null;
  } | null;
}

function emptyMeta(postId: string): PostMetadata {
  return {
    post_id: postId,
    outfit: null, backdrop: null, lighting: null, shot_type: null,
    duration_seconds: null, contrast_level: null,
    hook_type: null, hook_description: null,
    content_description: null, energy_level: null, editing_pace: null,
    music_name: null, audio_type: null,
    tested_variable: null, notes: null,
  };
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─────────────────────────────────────────────────────────────
// PillGroup — boutons enum
// ─────────────────────────────────────────────────────────────
function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            value === opt.value
              ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white bg-transparent"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────
function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${accent ? "border-amber-500/30" : "border-zinc-800"}`}>
        {accent && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
        <p className={`text-xs font-bold uppercase tracking-widest ${accent ? "text-amber-400" : "text-zinc-500"}`}>
          {title}
        </p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  accent?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full bg-zinc-800/60 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 transition-colors ${
        accent
          ? "border-amber-600/40 focus:border-amber-500 focus:ring-amber-500/20"
          : "border-zinc-700 focus:border-zinc-500 focus:ring-zinc-500/20"
      }`}
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-colors"
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────

const LIGHTING_OPTIONS = [
  { value: "natural_day", label: "Naturel jour" },
  { value: "golden_hour", label: "Golden hour" },
  { value: "studio", label: "Studio" },
  { value: "led_color", label: "LED colorées" },
  { value: "indoor_lamp", label: "Intérieur lampe" },
  { value: "night", label: "Nuit" },
] as const;

const SHOT_TYPE_OPTIONS = [
  { value: "tight_face", label: "Visage serré" },
  { value: "bust", label: "Buste" },
  { value: "mid_body", label: "Mi-corps" },
  { value: "full_body", label: "Corps entier" },
  { value: "low_angle", label: "Contre-plongée" },
  { value: "high_angle", label: "Plongée" },
] as const;

const CONTRAST_OPTIONS = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyen" },
  { value: "high", label: "Fort" },
] as const;

const HOOK_TYPE_OPTIONS = [
  { value: "text_overlay", label: "Texte overlay" },
  { value: "sound_music", label: "Son/Musique" },
  { value: "visual_surprise", label: "Visuel surprise" },
  { value: "pov_text", label: "POV textuel" },
  { value: "direct_transition", label: "Transition directe" },
] as const;

const ENERGY_OPTIONS = [
  { value: "calm", label: "Calme" },
  { value: "neutral", label: "Neutre" },
  { value: "dynamic", label: "Dynamique" },
  { value: "very_dynamic", label: "Très dynamique" },
] as const;

const PACE_OPTIONS = [
  { value: "slow", label: "Slow" },
  { value: "medium", label: "Medium" },
  { value: "fast_cuts", label: "Fast cuts" },
] as const;

const AUDIO_TYPE_OPTIONS = [
  { value: "trending", label: "Trending son" },
  { value: "original", label: "Musique originale" },
  { value: "voiceover", label: "Voix off" },
  { value: "no_audio", label: "Pas d'audio" },
  { value: "viral_reused", label: "Son viral réutilisé" },
] as const;

export function PostMetadataPanel({
  post,
  onClose,
}: {
  post: PostForPanel;
  onClose: () => void;
}) {
  const [meta, setMeta] = useState<PostMetadata>(emptyMeta(post.id));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  // Load existing metadata — prérempli la durée depuis Apify si pas encore renseignée
  useEffect(() => {
    setLoading(true);
    fetch(`/api/instagram/posts/${post.id}/metadata`)
      .then((r) => r.json())
      .then((d) => {
        if (d.metadata) {
          const loaded: PostMetadata = d.metadata;
          // Préremplir duration_seconds depuis Apify si le champ est vide
          if (loaded.duration_seconds == null && post.video_duration != null) {
            loaded.duration_seconds = post.video_duration;
          }
          setMeta(loaded);
        } else {
          const empty = emptyMeta(post.id);
          // Préremplir duration depuis Apify pour les nouvelles entrées
          if (post.video_duration != null) empty.duration_seconds = post.video_duration;
          setMeta(empty);
        }
      })
      .catch(() => setMeta(emptyMeta(post.id)))
      .finally(() => setLoading(false));
    isDirtyRef.current = false;
  }, [post.id, post.video_duration]);

  // Debounced auto-save (2s after last change)
  const scheduleSave = useCallback((updatedMeta: PostMetadata) => {
    isDirtyRef.current = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaving(true);
      fetch(`/api/instagram/posts/${updatedMeta.post_id}/metadata`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedMeta),
      })
        .then((r) => r.json())
        .then((d) => { if (d.metadata) setMeta(d.metadata); })
        .finally(() => {
          setSaving(false);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          isDirtyRef.current = false;
        });
    }, 1500);
  }, []);

  function update<K extends keyof PostMetadata>(key: K, value: PostMetadata[K]) {
    const next = { ...meta, [key]: value === "" ? null : value };
    setMeta(next);
    scheduleSave(next);
  }

  const snap = post.latest_snapshot;
  const views = snap?.views_count ?? snap?.plays_count;

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl z-50 bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-xs bg-zinc-800 text-zinc-400 rounded px-2 py-1 font-mono">
              {post.post_type}
            </div>
            <div className="flex items-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
              {saved && !saving && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="w-3 h-3" /> Sauvegardé
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
              title="Voir sur Instagram"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Post preview + metrics */}
        <div className="flex items-start gap-4 px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          {post.thumbnail_url ? (
            <img
              src={`/api/proxy/image?url=${encodeURIComponent(post.thumbnail_url)}`}
              alt=""
              className="w-16 rounded-lg object-cover flex-shrink-0"
              style={{ aspectRatio: "9/16" }}
            />
          ) : (
            <div className="w-16 rounded-lg bg-zinc-800 flex-shrink-0" style={{ aspectRatio: "9/16" }} />
          )}
          <div className="min-w-0 flex-1">
            {post.caption && (
              <p className="text-xs text-zinc-400 line-clamp-3 mb-2 leading-relaxed">
                {post.caption}
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Vues", value: fmt(views) },
                { label: "Likes", value: fmt(snap?.likes_count) },
                { label: "Commentaires", value: fmt(snap?.comments_count) },
                {
                  label: "ER",
                  value: views && snap?.likes_count != null
                    ? `${(((snap.likes_count + (snap.comments_count ?? 0)) / views) * 100).toFixed(1)}%`
                    : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-800/60 rounded px-2 py-1.5">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form (scrollable) */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-5">

            {/* ── VISUEL ───────────────────────────────── */}
            <Section title="Visuel">
              <Field label="Tenue">
                <TextInput
                  value={meta.outfit ?? ""}
                  onChange={(v) => update("outfit", v)}
                  placeholder="Ex : robe noire, crop top blanc…"
                />
              </Field>
              <Field label="Fond / décor">
                <TextInput
                  value={meta.backdrop ?? ""}
                  onChange={(v) => update("backdrop", v)}
                  placeholder="Ex : chambre blanche, extérieur parc…"
                />
              </Field>
              <Field label="Éclairage">
                <PillGroup
                  options={LIGHTING_OPTIONS}
                  value={meta.lighting as typeof LIGHTING_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("lighting", v)}
                />
              </Field>
              <Field label="Plan">
                <PillGroup
                  options={SHOT_TYPE_OPTIONS}
                  value={meta.shot_type as typeof SHOT_TYPE_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("shot_type", v)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Durée (secondes)">
                  <input
                    type="number"
                    value={meta.duration_seconds ?? ""}
                    onChange={(e) => update("duration_seconds", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Ex : 30"
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-colors"
                  />
                </Field>
                <Field label="Contraste modèle/fond">
                  <PillGroup
                    options={CONTRAST_OPTIONS}
                    value={meta.contrast_level as typeof CONTRAST_OPTIONS[number]["value"] | null}
                    onChange={(v) => update("contrast_level", v)}
                  />
                </Field>
              </div>
            </Section>

            {/* ── HOOK ─────────────────────────────────── */}
            <Section title="Hook (0–2s)">
              <Field label="Type de hook">
                <PillGroup
                  options={HOOK_TYPE_OPTIONS}
                  value={meta.hook_type as typeof HOOK_TYPE_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("hook_type", v)}
                />
              </Field>
              <Field label="Description du hook">
                <TextArea
                  value={meta.hook_description ?? ""}
                  onChange={(v) => update("hook_description", v)}
                  placeholder="Ce qui se passe exactement dans les 2 premières secondes…"
                  rows={2}
                />
              </Field>
            </Section>

            {/* ── CONTENU ──────────────────────────────── */}
            <Section title="Contenu (Meat)">
              <Field label="Description">
                <TextArea
                  value={meta.content_description ?? ""}
                  onChange={(v) => update("content_description", v)}
                  placeholder="Ce qui se passe dans la vidéo…"
                  rows={3}
                />
              </Field>
              <Field label="Énergie">
                <PillGroup
                  options={ENERGY_OPTIONS}
                  value={meta.energy_level as typeof ENERGY_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("energy_level", v)}
                />
              </Field>
              <Field label="Rythme de montage">
                <PillGroup
                  options={PACE_OPTIONS}
                  value={meta.editing_pace as typeof PACE_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("editing_pace", v)}
                />
              </Field>
            </Section>

            {/* ── AUDIO ────────────────────────────────── */}
            <Section title="Audio">
              <Field label="Nom de la musique / son">
                <TextInput
                  value={meta.music_name ?? ""}
                  onChange={(v) => update("music_name", v)}
                  placeholder="Ex : Flowers – Miley Cyrus, son trending #xyz…"
                />
              </Field>
              <Field label="Type d'audio">
                <PillGroup
                  options={AUDIO_TYPE_OPTIONS}
                  value={meta.audio_type as typeof AUDIO_TYPE_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("audio_type", v)}
                />
              </Field>
            </Section>

            {/* ── VARIABLE TESTÉE ──────────────────────── */}
            <Section title="Variable testée" accent>
              <Field label="">
                <TextArea
                  value={meta.tested_variable ?? ""}
                  onChange={(v) => update("tested_variable", v)}
                  placeholder='Ex : "Même hook que F2 mais décor extérieur au lieu de chambre" — Ce champ est clé pour corréler créatif ↔ perfs.'
                  rows={3}
                  accent
                />
              </Field>
            </Section>

            {/* ── NOTES ────────────────────────────────── */}
            <Section title="Notes libres">
              <TextArea
                value={meta.notes ?? ""}
                onChange={(v) => update("notes", v)}
                placeholder="Observations, idées, contexte de tournage…"
                rows={3}
              />
            </Section>

            <div className="h-8" />
          </div>
        )}

        {/* Footer save status */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 flex-shrink-0 text-xs text-zinc-600">
          <span>Sauvegarde automatique — 1.5s après la dernière modification</span>
          {saving && (
            <span className="flex items-center gap-1 text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde…
            </span>
          )}
          {saved && !saving && (
            <span className="flex items-center gap-1 text-emerald-500">
              <Check className="w-3 h-3" /> Sauvegardé
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Retourne true si au moins un champ important de la metadata est rempli.
 */
export function hasMetadata(meta: PostMetadata | null): boolean {
  if (!meta) return false;
  return !!(
    meta.tested_variable || meta.hook_type || meta.lighting ||
    meta.shot_type || meta.energy_level || meta.audio_type || meta.music_name
  );
}
