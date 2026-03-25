"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { ProtectedPage } from "@/components/protected-page";
import type {
  InstagramAccount,
  Model,
  Account,
  OneUpSocialAccount,
  GMSLink,
  OFTrackingLink,
} from "@/types";
import {
  Plus,
  Search,
  AtSign,
  Trash2,
  Pencil,
  X,
  ChevronDown,
  Loader2,
  Check,
  AlertCircle,
  CheckCircle2,
  Link2,
  ExternalLink,
} from "lucide-react";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
        status === "active"
          ? "bg-success/10 text-success border border-success/20"
          : "bg-muted-foreground/10 text-muted-foreground border border-border"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", status === "active" ? "bg-success" : "bg-muted-foreground")} />
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

/* ─── Searchable Select ─── */
interface SearchableSelectProps<T> {
  label: string;
  placeholder: string;
  items: T[];
  value: T | null;
  onSelect: (item: T | null) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | null;
  isDisabled?: (item: T) => boolean;
  disabledReason?: string;
  loading?: boolean;
  error?: string | null;
  badge?: (item: T) => React.ReactNode;
}

function SearchableSelect<T>({
  label,
  placeholder,
  items,
  value,
  onSelect,
  getKey,
  getLabel,
  getSubLabel,
  isDisabled,
  loading,
  error,
  badge,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = items.filter((item) => {
    const q = query.toLowerCase();
    return (
      getLabel(item).toLowerCase().includes(q) ||
      (getSubLabel?.(item)?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm text-left flex items-center justify-between gap-2 hover:border-accent/50 transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? getLabel(value) : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full h-8 pl-8 pr-3 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-xs text-danger px-3 py-4">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">No results</p>
            ) : (
              filtered.map((item) => {
                const disabled = isDisabled?.(item) ?? false;
                const isSelected = value ? getKey(value) === getKey(item) : false;
                return (
                  <button
                    key={getKey(item)}
                    type="button"
                    disabled={disabled}
                    onClick={() => { if (!disabled) { onSelect(item); setOpen(false); setQuery(""); } }}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition-colors",
                      disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-accent/10 cursor-pointer",
                      isSelected && "bg-accent/15"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{getLabel(item)}</p>
                      {getSubLabel && <p className="text-xs text-muted-foreground truncate">{getSubLabel(item)}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {badge?.(item)}
                      {disabled && <span className="text-[10px] text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded">In use</span>}
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent-light" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Add / Edit Account Modal ─── */
interface AccountModalProps {
  account?: InstagramAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}

function AccountModal({ account, onClose, onSuccess }: AccountModalProps) {
  const isEdit = !!account;

  // Form state — handle is derived from OneUp, not typed manually
  const [niche, setNiche] = useState(account?.niche ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(account?.status ?? "active");

  // Pickers
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedOneUp, setSelectedOneUp] = useState<OneUpSocialAccount | null>(null);
  const [selectedGMS, setSelectedGMS] = useState<GMSLink | null>(null);
  const [selectedOFAccount, setSelectedOFAccount] = useState<Account | null>(null);
  const [selectedTracking, setSelectedTracking] = useState<OFTrackingLink | null>(null);

  // Data lists
  const [models, setModels] = useState<Model[]>([]);
  const [oneupAccounts, setOneupAccounts] = useState<OneUpSocialAccount[]>([]);
  const [gmsLinks, setGmsLinks] = useState<GMSLink[]>([]);
  const [ofAccounts, setOfAccounts] = useState<Account[]>([]);
  const [trackingLinks, setTrackingLinks] = useState<OFTrackingLink[]>([]);

  // Loading/error states
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingOneup, setLoadingOneup] = useState(true);
  const [loadingGMS, setLoadingGMS] = useState(true);
  const [loadingOFAccounts, setLoadingOFAccounts] = useState(false);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [errorOneup, setErrorOneup] = useState<string | null>(null);
  const [errorGMS, setErrorGMS] = useState<string | null>(null);
  const [errorTracking, setErrorTracking] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Load models, oneup accounts, gms links once
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/models").then((r) => r.json()),
      fetch("/api/admin/oneup/social-accounts").then((r) => r.json()),
      fetch("/api/admin/gms/links").then((r) => r.json()),
    ]).then(([modelsData, oneupData, gmsData]) => {
      setModels(modelsData.models ?? []);
      setLoadingModels(false);

      if (oneupData.error) setErrorOneup(oneupData.error);
      else setOneupAccounts(oneupData.accounts ?? []);
      setLoadingOneup(false);

      if (gmsData.error) setErrorGMS(gmsData.error);
      else setGmsLinks(gmsData.links ?? []);
      setLoadingGMS(false);
    });
  }, []);

  // Pre-fill edit mode
  useEffect(() => {
    if (!account || models.length === 0) return;
    const m = models.find((m) => m.id === account.model_id) ?? null;
    setSelectedModel(m);

    if (account.oneup_social_network_id) {
      const ou = oneupAccounts.find((a) => a.social_network_id === account.oneup_social_network_id) ?? null;
      if (!ou && account.oneup_social_network_id) {
        setSelectedOneUp({
          social_network_id: account.oneup_social_network_id,
          social_network_name: account.oneup_social_network_name ?? account.oneup_social_network_id,
          category_id: account.oneup_category_id ?? "",
          category_name: "",
          is_expired: false,
          isAssigned: true,
        });
      } else {
        setSelectedOneUp(ou);
      }
    }

    if (account.get_my_social_link_id) {
      const g = gmsLinks.find((l) => l.id === account.get_my_social_link_id) ?? null;
      if (!g) {
        setSelectedGMS({
          id: account.get_my_social_link_id,
          title: account.get_my_social_link_name ?? account.get_my_social_link_id,
          url: null,
          isAssigned: true,
        });
      } else {
        setSelectedGMS(g);
      }
    }
  }, [account, models, oneupAccounts, gmsLinks]);

  // Load OF accounts when model is selected
  useEffect(() => {
    if (!selectedModel) { setOfAccounts([]); setSelectedOFAccount(null); return; }
    setLoadingOFAccounts(true);
    fetch(`/api/admin/accounts?model_id=${selectedModel.id}`)
      .then((r) => r.json())
      .then((d) => {
        setOfAccounts(d.accounts ?? []);
        if (account?.of_account_id) {
          const oa = (d.accounts ?? []).find((a: Account) => a.id === account.of_account_id) ?? null;
          setSelectedOFAccount(oa);
        }
        setLoadingOFAccounts(false);
      });
  }, [selectedModel, account?.of_account_id]);

  // Load tracking links when OF account changes
  useEffect(() => {
    if (!selectedOFAccount?.ofapi_account_id) { setTrackingLinks([]); setSelectedTracking(null); return; }
    setLoadingTracking(true);
    setErrorTracking(null);
    fetch(`/api/admin/ofapi/tracking-links?account_id=${selectedOFAccount.ofapi_account_id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setErrorTracking(d.error); setLoadingTracking(false); return; }
        setTrackingLinks(d.links ?? []);
        if (account?.of_tracking_link_id) {
          const t = (d.links ?? []).find((l: OFTrackingLink) => l.id === account.of_tracking_link_id) ?? null;
          if (!t && account.of_tracking_link_id) {
            setSelectedTracking({
              id: account.of_tracking_link_id,
              name: account.of_tracking_link_url ?? account.of_tracking_link_id,
              url: account.of_tracking_link_url,
              isAssigned: true,
            });
          } else {
            setSelectedTracking(t);
          }
        }
        setLoadingTracking(false);
      });
  }, [selectedOFAccount, account?.of_tracking_link_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedOneUp) { setFormError("Please select an Instagram account from OneUp."); return; }
    if (!selectedModel) { setFormError("Please select a model."); return; }

    // Handle is derived from the OneUp account name
    const derivedHandle = selectedOneUp.social_network_name.replace(/^@/, "");

    setSaving(true);
    const payload = {
      model_id: selectedModel.id,
      of_account_id: selectedOFAccount?.id ?? null,
      instagram_handle: derivedHandle,
      oneup_social_network_id: selectedOneUp?.social_network_id ?? null,
      oneup_social_network_name: selectedOneUp?.social_network_name ?? null,
      oneup_category_id: selectedOneUp?.category_id ?? null,
      get_my_social_link_id: selectedGMS?.id ?? null,
      get_my_social_link_name: selectedGMS?.title ?? null,
      of_tracking_link_id: selectedTracking?.id ?? null,
      of_tracking_link_url: selectedTracking?.url ?? null,
      niche: niche.trim() || null,
      status,
    };

    const url = isEdit
      ? `/api/admin/instagram-accounts/${account!.id}`
      : "/api/admin/instagram-accounts";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setFormError(data.error ?? "Something went wrong."); return; }
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">{isEdit ? "Edit Account" : "Add Instagram Account"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Connect an Instagram account to your funnel</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted-foreground/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-5">

            {/* Section: Instagram account from OneUp */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Instagram Account</p>
              <p className="text-xs text-muted-foreground mb-3">Select an account from OneUp — only unlinked accounts are shown.</p>
              <SearchableSelect<OneUpSocialAccount>
                label="Instagram account *"
                placeholder="Pick an account from OneUp…"
                items={oneupAccounts}
                value={selectedOneUp}
                onSelect={setSelectedOneUp}
                getKey={(a) => a.social_network_id}
                getLabel={(a) => `@${a.social_network_name}`}
                getSubLabel={(a) => a.category_name || null}
                isDisabled={(a) => a.isAssigned && a.social_network_id !== account?.oneup_social_network_id}
                loading={loadingOneup}
                error={errorOneup}
              />
              {selectedOneUp && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Handle: <span className="font-mono text-foreground">@{selectedOneUp.social_network_name}</span>
                  {selectedOneUp.category_name && (
                    <>{" · "}<span className="text-foreground">{selectedOneUp.category_name}</span></>
                  )}
                </p>
              )}
            </div>

            <hr className="border-border" />

            {/* Section: Niche */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niche / Description</label>
              <textarea
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Fitness lifestyle, 18-35 women, English-speaking audience. Posts 5x/week. Focus on transformation & motivation content."
                rows={3}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all placeholder:text-muted-foreground"
              />
            </div>

            <hr className="border-border" />

            {/* Section: Model */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Model</p>
              <SearchableSelect<Model>
                label="Associated model *"
                placeholder="Pick a model…"
                items={models}
                value={selectedModel}
                onSelect={setSelectedModel}
                getKey={(m) => m.id}
                getLabel={(m) => m.name}
                getSubLabel={(m) => m.status === "inactive" ? "Inactive" : null}
                loading={loadingModels}
              />
            </div>

            <hr className="border-border" />

            {/* Section: GetMySocial */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">GetMySocial Link (Bio)</p>
              <SearchableSelect<GMSLink>
                label="Bio link"
                placeholder="Pick a GMS link…"
                items={gmsLinks}
                value={selectedGMS}
                onSelect={setSelectedGMS}
                getKey={(l) => l.id}
                getLabel={(l) => l.title}
                getSubLabel={(l) => l.url}
                isDisabled={(l) => l.isAssigned && l.id !== account?.get_my_social_link_id}
                loading={loadingGMS}
                error={errorGMS}
              />
            </div>

            <hr className="border-border" />

            {/* Section: OF Account + Tracking Link */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">OnlyFans (Conversion)</p>

              {!selectedModel ? (
                <p className="text-xs text-muted-foreground italic py-2">Select a model first to see linked OF accounts.</p>
              ) : (
                <div className="space-y-4">
                  <SearchableSelect<Account>
                    label="OF account"
                    placeholder="Pick an OF account…"
                    items={ofAccounts}
                    value={selectedOFAccount}
                    onSelect={(a) => { setSelectedOFAccount(a); setSelectedTracking(null); }}
                    getKey={(a) => a.id}
                    getLabel={(a) => a.of_username ?? a.ofapi_account_id ?? a.id}
                    loading={loadingOFAccounts}
                  />

                  {selectedOFAccount && (
                    <SearchableSelect<OFTrackingLink>
                      label="Tracking link"
                      placeholder="Pick a tracking link…"
                      items={trackingLinks}
                      value={selectedTracking}
                      onSelect={setSelectedTracking}
                      getKey={(l) => l.id}
                      getLabel={(l) => l.name}
                      getSubLabel={(l) => l.url}
                      isDisabled={(l) => l.isAssigned && l.id !== account?.of_tracking_link_id}
                      loading={loadingTracking}
                      error={errorTracking}
                    />
                  )}
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <div className="flex gap-2">
                {(["active", "inactive"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "h-9 px-4 rounded-lg text-sm font-medium border transition-colors capitalize",
                      status === s
                        ? "bg-accent text-white border-accent"
                        : "bg-background border-border text-muted-foreground hover:border-accent/50"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 px-3 py-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card shrink-0">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-background border border-border rounded-lg text-sm hover:bg-card-hover transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Avatar with fallback ─── */
function Avatar({ src, fallback, size = 7 }: { src?: string | null; fallback: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full border border-border bg-accent/10 flex items-center justify-center overflow-hidden shrink-0`;
  return (
    <div className={cls}>
      {src ? (
        <img src={src} alt={fallback} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <span className="text-[10px] font-bold text-accent-light">{fallback[0]?.toUpperCase()}</span>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<InstagramAccount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/instagram-accounts");
    const data = await res.json();
    setAccounts(data.accounts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this account?")) return;
    setDeletingId(id);
    await fetch(`/api/admin/instagram-accounts/${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchAccounts();
  };

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.instagram_handle.toLowerCase().includes(q) ||
      (a.niche?.toLowerCase().includes(q) ?? false) ||
      ((a.model as { name: string } | undefined)?.name?.toLowerCase().includes(q) ?? false)
    );
  });

  const activeCount = accounts.filter((a) => a.status === "active").length;

  return (
    <ProtectedPage pageId="accounts">
      <div className="flex flex-col h-full min-h-0">
        <Header
          title="Accounts"
          subtitle={`${accounts.length} Instagram account${accounts.length !== 1 ? "s" : ""} · ${activeCount} active`}
        />

        <div className="flex-1 overflow-y-auto p-6">
          {/* Top bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by handle, niche, model…"
                className="w-full h-9 pl-9 pr-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              />
            </div>
            <button
              onClick={() => { setEditAccount(null); setShowModal(true); }}
              className="h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <AtSign className="w-6 h-6 text-accent-light" />
              </div>
              <p className="text-sm font-medium">
                {search ? "No accounts match your search" : "No accounts yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Add your first Instagram account to get started"}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">OF Account</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">GMS Link</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tracking</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((account) => {
                    const model = account.model as { name: string; avatar_url: string | null } | undefined;
                    const ofAccount = account.of_account as { of_username: string | null; of_avatar_url: string | null } | undefined;
                    return (
                      <tr key={account.id} className="hover:bg-background/30 transition-colors">
                        {/* Handle */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                              <AtSign className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">@{account.instagram_handle}</p>
                              {account.niche && <p className="text-xs text-muted-foreground">{account.niche}</p>}
                            </div>
                          </div>
                        </td>

                        {/* Model */}
                        <td className="px-5 py-4">
                          {model ? (
                            <div className="flex items-center gap-2">
                              <Avatar src={model.avatar_url} fallback={model.name} size={7} />
                              <span className="text-sm">{model.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* OF Account */}
                        <td className="px-5 py-4">
                          {ofAccount?.of_username ? (
                            <div className="flex items-center gap-2">
                              <Avatar src={ofAccount.of_avatar_url} fallback={ofAccount.of_username} size={7} />
                              <span className="text-sm">@{ofAccount.of_username}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* GMS Link */}
                        <td className="px-5 py-4">
                          {account.get_my_social_link_id ? (
                            <div className="flex items-center gap-1.5">
                              <Link2 className="w-3.5 h-3.5 text-accent-light shrink-0" />
                              <span className="text-sm truncate max-w-[120px]">{account.get_my_social_link_name ?? account.get_my_social_link_id}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Tracking Link */}
                        <td className="px-5 py-4">
                          {account.of_tracking_link_id ? (
                            <div className="flex items-center gap-1.5">
                              {account.of_tracking_link_url ? (
                                <a
                                  href={account.of_tracking_link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm text-accent-light hover:underline truncate max-w-[120px]"
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                  {account.of_tracking_link_id}
                                </a>
                              ) : (
                                <span className="text-sm truncate max-w-[120px]">{account.of_tracking_link_id}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <StatusBadge status={account.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => { setEditAccount(account); setShowModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-accent-light transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(account.id)}
                              disabled={deletingId === account.id}
                              className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors disabled:opacity-40"
                              title="Delete"
                            >
                              {deletingId === account.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(showModal || editAccount) && (
          <AccountModal
            account={editAccount}
            onClose={() => { setShowModal(false); setEditAccount(null); }}
            onSuccess={fetchAccounts}
          />
        )}
      </div>
    </ProtectedPage>
  );
}
