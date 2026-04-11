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
// PillGroup — enum buttons
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
  { value: "natural_day", label: "Natural day" },
  { value: "golden_hour", label: "Golden hour" },
  { value: "studio", label: "Studio" },
  { value: "led_color", label: "Colored LEDs" },
  { value: "indoor_lamp", label: "Indoor lamp" },
  { value: "night", label: "Night" },
] as const;

const SHOT_TYPE_OPTIONS = [
  { value: "tight_face", label: "Tight face" },
  { value: "bust", label: "Bust" },
  { value: "mid_body", label: "Mid-body" },
  { value: "full_body", label: "Full body" },
  { value: "low_angle", label: "Low angle" },
  { value: "high_angle", label: "High angle" },
] as const;

const CONTRAST_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

const HOOK_TYPE_OPTIONS = [
  { value: "text_overlay", label: "Text overlay" },
  { value: "sound_music", label: "Sound/Music" },
  { value: "visual_surprise", label: "Visual surprise" },
  { value: "pov_text", label: "Text POV" },
  { value: "direct_transition", label: "Direct transition" },
] as const;

const ENERGY_OPTIONS = [
  { value: "calm", label: "Calm" },
  { value: "neutral", label: "Neutral" },
  { value: "dynamic", label: "Dynamic" },
  { value: "very_dynamic", label: "Very dynamic" },
] as const;

const PACE_OPTIONS = [
  { value: "slow", label: "Slow" },
  { value: "medium", label: "Medium" },
  { value: "fast_cuts", label: "Fast cuts" },
] as const;

const AUDIO_TYPE_OPTIONS = [
  { value: "trending", label: "Trending sound" },
  { value: "original", label: "Original music" },
  { value: "voiceover", label: "Voiceover" },
  { value: "no_audio", label: "No audio" },
  { value: "viral_reused", label: "Reused viral sound" },
] as const;

// ─────────────────────────────────────────────────────────────
// Thumbnail with proxy + onError fallback
// ─────────────────────────────────────────────────────────────
function ThumbnailImg({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  const [errCount, setErrCount] = useState(0);
  const proxied = `/api/proxy/image?url=${encodeURIComponent(src)}`;
  if (errCount >= 2) {
    return <div className={className} style={{ ...style, background: "#27272a" }} />;
  }
  return (
    <img
      src={errCount === 0 ? proxied : src}
      alt=""
      className={className}
      style={style}
      onError={() => setErrCount((n) => n + 1)}
    />
  );
}

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
          // Toujours écraser depuis Apify — valeur sûre, pas d'entrée manuelle
          if (post.video_duration != null) loaded.duration_seconds = Math.round(post.video_duration);
          setMeta(loaded);
        } else {
          const empty = emptyMeta(post.id);
          if (post.video_duration != null) empty.duration_seconds = Math.round(post.video_duration);
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
                  <Check className="w-3 h-3" /> Saved
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
              title="View on Instagram"
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
            <ThumbnailImg
              src={post.thumbnail_url}
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
                { label: "Unique Views", value: fmt(views) },
                { label: "Likes", value: fmt(snap?.likes_count) },
                { label: "Comments", value: fmt(snap?.comments_count) },
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
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-5">

            {/* ── VISUEL ───────────────────────────────── */}
            <Section title="Visual">
              <Field label="Outfit">
                <TextInput
                  value={meta.outfit ?? ""}
                  onChange={(v) => update("outfit", v)}
                  placeholder="E.g.: black dress, white crop top…"
                />
              </Field>
              <Field label="Background / setting">
                <TextInput
                  value={meta.backdrop ?? ""}
                  onChange={(v) => update("backdrop", v)}
                  placeholder="E.g.: white room, outdoor park…"
                />
              </Field>
              <Field label="Lighting">
                <PillGroup
                  options={LIGHTING_OPTIONS}
                  value={meta.lighting as typeof LIGHTING_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("lighting", v)}
                />
              </Field>
              <Field label="Shot type">
                <PillGroup
                  options={SHOT_TYPE_OPTIONS}
                  value={meta.shot_type as typeof SHOT_TYPE_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("shot_type", v)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration">
                  <div className="flex items-center gap-2 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-2 h-[38px]">
                    {meta.duration_seconds != null ? (
                      <>
                        <span className="text-sm font-semibold text-white">
                          {meta.duration_seconds >= 60
                            ? `${Math.floor(meta.duration_seconds / 60)}m ${meta.duration_seconds % 60}s`
                            : `${meta.duration_seconds}s`}
                        </span>
                        <span className="ml-auto text-[9px] text-zinc-600 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 uppercase tracking-wide">API</span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600 italic">Reels sync required</span>
                    )}
                  </div>
                </Field>
                <Field label="Model/background contrast">
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
              <Field label="Hook type">
                <PillGroup
                  options={HOOK_TYPE_OPTIONS}
                  value={meta.hook_type as typeof HOOK_TYPE_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("hook_type", v)}
                />
              </Field>
              <Field label="Hook description">
                <TextArea
                  value={meta.hook_description ?? ""}
                  onChange={(v) => update("hook_description", v)}
                  placeholder="What happens exactly in the first 2 seconds…"
                  rows={2}
                />
              </Field>
            </Section>

            {/* ── CONTENU ──────────────────────────────── */}
            <Section title="Content (Meat)">
              <Field label="Description">
                <TextArea
                  value={meta.content_description ?? ""}
                  onChange={(v) => update("content_description", v)}
                  placeholder="What happens in the video…"
                  rows={3}
                />
              </Field>
              <Field label="Energy">
                <PillGroup
                  options={ENERGY_OPTIONS}
                  value={meta.energy_level as typeof ENERGY_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("energy_level", v)}
                />
              </Field>
              <Field label="Editing pace">
                <PillGroup
                  options={PACE_OPTIONS}
                  value={meta.editing_pace as typeof PACE_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("editing_pace", v)}
                />
              </Field>
            </Section>

            {/* ── AUDIO ────────────────────────────────── */}
            <Section title="Audio">
              <Field label="Music / sound name">
                <TextInput
                  value={meta.music_name ?? ""}
                  onChange={(v) => update("music_name", v)}
                  placeholder="E.g.: Flowers – Miley Cyrus, trending sound #xyz…"
                />
              </Field>
              <Field label="Audio type">
                <PillGroup
                  options={AUDIO_TYPE_OPTIONS}
                  value={meta.audio_type as typeof AUDIO_TYPE_OPTIONS[number]["value"] | null}
                  onChange={(v) => update("audio_type", v)}
                />
              </Field>
            </Section>

            {/* ── VARIABLE TESTÉE ──────────────────────── */}
            <Section title="Tested variable" accent>
              <Field label="">
                <TextArea
                  value={meta.tested_variable ?? ""}
                  onChange={(v) => update("tested_variable", v)}
                  placeholder='E.g.: "Same hook as F2 but outdoor setting instead of room" — This field is key to correlate creative ↔ performance.'
                  rows={3}
                  accent
                />
              </Field>
            </Section>

            {/* ── NOTES ────────────────────────────────── */}
            <Section title="Free notes">
              <TextArea
                value={meta.notes ?? ""}
                onChange={(v) => update("notes", v)}
                placeholder="Observations, ideas, shooting context…"
                rows={3}
              />
            </Section>

            <div className="h-8" />
          </div>
        )}

        {/* Footer save status */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-zinc-800 flex-shrink-0 text-xs text-zinc-600">
          {saving && (
            <span className="flex items-center gap-1 text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
          )}
          {saved && !saving && (
            <span className="flex items-center gap-1 text-emerald-500">
              <Check className="w-3 h-3" /> Saved
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
