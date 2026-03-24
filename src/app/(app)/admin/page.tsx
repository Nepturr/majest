"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { ALL_PAGES } from "@/lib/pages";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Model } from "@/types";
import {
  Plus, Pencil, Trash2, Shield, User, Copy, Check,
  X, Loader2, AlertCircle, Users, Plug, Sparkles,
  ImageOff, Upload, FileBox,
} from "lucide-react";

/* ─── Tab config ─── */
const TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "models", label: "Models", icon: Sparkles },
  { id: "api", label: "API", icon: Plug },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  allowed_pages: string[];
  created_at: string;
}

/* ─── Page ─── */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("users");

  return (
    <>
      <Header title="Admin" subtitle="Manage your workspace" />

      <div className="border-b border-border px-6">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                  isActive
                    ? "border-accent text-accent-light"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {activeTab === "users" && <UsersTab />}
        {activeTab === "models" && <ModelsTab />}
        {activeTab === "api" && <ApiTab />}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   UPLOAD HELPERS
───────────────────────────────────────────── */

async function uploadAvatar(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

async function uploadLora(file: File): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("lora-files").upload(file.name, file, { upsert: true });
  if (error) throw new Error(error.message);
  return file.name;
}

/* ─── Avatar Drop Zone ─── */
function AvatarDropZone({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [imgError, setImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError("");
    setUploading(true);
    setImgError(false);
    try {
      const url = await uploadAvatar(file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (value && !imgError) {
    return (
      <div className="relative group w-20 h-20">
        <img
          src={value}
          alt="Avatar"
          onError={() => setImgError(true)}
          className="w-20 h-20 rounded-full object-cover border border-border"
        />
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger border border-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handle(file);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
          dragging ? "border-accent bg-accent/5" : "border-border hover:border-border-light hover:bg-card-hover",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
        />
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground text-center">
              Drop an image or <span className="text-accent-light">browse</span>
            </span>
          </>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ─── LoRA Drop Zone ─── */
function LoraDropZone({
  value,
  onChange,
}: {
  value: string;
  onChange: (filename: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    if (!file.name.endsWith(".safetensors")) {
      setError("Only .safetensors files are accepted.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const filename = await uploadLora(file);
      onChange(filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-accent/5 border border-accent/20 rounded-xl">
        <FileBox className="w-5 h-5 text-accent-light shrink-0" />
        <code className="text-xs text-accent-light font-mono flex-1 truncate">{value}</code>
        <button
          type="button"
          onClick={() => onChange("")}
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent/20 transition-colors shrink-0"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handle(file);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
          dragging ? "border-accent bg-accent/5" : "border-border hover:border-border-light hover:bg-card-hover",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".safetensors"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
        />
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Uploading…</span>
          </>
        ) : (
          <>
            <FileBox className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground text-center">
              Drop a <span className="font-mono text-accent-light">.safetensors</span> file or{" "}
              <span className="text-accent-light">browse</span>
            </span>
          </>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODELS TAB
───────────────────────────────────────────── */
function ModelsTab() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModel, setEditModel] = useState<Model | null>(null);
  const [deleteModel, setDeleteModel] = useState<Model | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/models");
    const data = await res.json();
    setModels(data.models ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const handleDelete = async (model: Model) => {
    const res = await fetch(`/api/admin/models/${model.id}`, { method: "DELETE" });
    if (res.ok) {
      setModels((prev) => prev.filter((m) => m.id !== model.id));
      setDeleteModel(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold">AI Models</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage AI personas and their associated LoRA files
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Model
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-xl">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No models yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first model to get started.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Model</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">LoRA</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Persona</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {models.map((model, i) => (
                <tr
                  key={model.id}
                  className="border-b border-border last:border-0 hover:bg-card-hover transition-colors animate-fade-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <ModelAvatar model={model} size="sm" />
                      <p className="text-sm font-medium">{model.name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {model.lora_id ? (
                      <code className="text-xs text-accent-light bg-accent/10 border border-accent/20 px-2 py-0.5 rounded font-mono">
                        {model.lora_id}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    <p className="text-xs text-muted-foreground truncate">
                      {model.persona ?? "—"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={model.status} />
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {new Date(model.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditModel(model)}
                        className="w-8 h-8 rounded-lg hover:bg-background border border-transparent hover:border-border flex items-center justify-center transition-all"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeleteModel(model)}
                        className="w-8 h-8 rounded-lg hover:bg-danger/10 border border-transparent hover:border-danger/20 flex items-center justify-center transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <ModelFormModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { fetchModels(); setShowAddModal(false); }}
        />
      )}
      {editModel && (
        <ModelFormModal
          model={editModel}
          onClose={() => setEditModel(null)}
          onSuccess={() => { fetchModels(); setEditModel(null); }}
        />
      )}
      {deleteModel && (
        <ConfirmDeleteModelModal
          model={deleteModel}
          onClose={() => setDeleteModel(null)}
          onConfirm={() => handleDelete(deleteModel)}
        />
      )}
    </>
  );
}

/* ─── Model Avatar ─── */
function ModelAvatar({ model, size = "sm" }: { model: Model; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-14 h-14" : "w-9 h-9";
  const textSize = size === "lg" ? "text-lg" : "text-sm";
  const [imgError, setImgError] = useState(false);

  if (model.avatar_url && !imgError) {
    return (
      <img
        src={model.avatar_url}
        alt={model.name}
        onError={() => setImgError(true)}
        className={cn(dim, "rounded-full object-cover border border-border shrink-0")}
      />
    );
  }

  return (
    <div className={cn(dim, "rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0")}>
      {model.avatar_url && imgError ? (
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      ) : (
        <span className={cn("font-bold text-accent-light", textSize)}>
          {model.name[0].toUpperCase()}
        </span>
      )}
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
      status === "active"
        ? "bg-success/10 text-success border-success/20"
        : "bg-muted-foreground/10 text-muted-foreground border-border"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", status === "active" ? "bg-success" : "bg-muted-foreground")} />
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

/* ─── Model Form Modal ─── */
interface ModelFormModalProps {
  model?: Model;
  onClose: () => void;
  onSuccess: () => void;
}

function ModelFormModal({ model, onClose, onSuccess }: ModelFormModalProps) {
  const isEdit = !!model;

  const [name, setName] = useState(model?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(model?.avatar_url ?? "");
  const [persona, setPersona] = useState(model?.persona ?? "");
  const [loraId, setLoraId] = useState(model?.lora_id ?? "");
  const [brandNotes, setBrandNotes] = useState(model?.brand_notes ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(model?.status ?? "active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(
      isEdit ? `/api/admin/models/${model.id}` : "/api/admin/models",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          avatar_url: avatarUrl,
          persona,
          lora_id: loraId,
          brand_notes: brandNotes,
          status,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Something went wrong.");
    else onSuccess();
    setLoading(false);
  };

  return (
    <Modal title={isEdit ? `Edit — ${model.name}` : "Add a Model"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Name */}
        <Field label="Name *">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Suki"
            required
            className={inputCls}
          />
        </Field>

        {/* Avatar */}
        <Field label="Avatar">
          <AvatarDropZone value={avatarUrl} onChange={setAvatarUrl} />
        </Field>

        {/* Persona */}
        <Field label="Persona">
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="e.g. Asian, 23 years old, 5ft4, almond eyes, long black hair…"
            rows={3}
            className={cn(inputCls, "h-auto resize-none py-3")}
          />
          <p className="text-[11px] text-muted-foreground">
            Fixed physical description — will guide the AI during content generation.
          </p>
        </Field>

        {/* LoRA File */}
        <Field label="LoRA File">
          <LoraDropZone value={loraId} onChange={setLoraId} />
        </Field>

        {/* Brand Notes */}
        <Field label="Brand Notes">
          <textarea
            value={brandNotes}
            onChange={(e) => setBrandNotes(e.target.value)}
            placeholder="Free notes on branding, tone, topics to avoid…"
            rows={3}
            className={cn(inputCls, "h-auto resize-none py-3")}
          />
        </Field>

        {/* Status */}
        <Field label="Status">
          <div className="grid grid-cols-2 gap-2">
            {(["active", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all",
                  status === s
                    ? s === "active"
                      ? "bg-success/15 border-success/30 text-success"
                      : "bg-muted-foreground/10 border-border text-muted-foreground"
                    : "bg-card border-border text-muted hover:border-border-light"
                )}
              >
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  s === "active" ? "bg-success" : "bg-muted-foreground"
                )} />
                {s === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </Field>

        {error && (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {isEdit ? "Saving…" : "Creating…"}</>
          ) : isEdit ? (
            "Save Changes"
          ) : (
            <><Plus className="w-4 h-4" /> Add Model</>
          )}
        </button>
      </form>
    </Modal>
  );
}

/* ─── Confirm Delete Model ─── */
function ConfirmDeleteModelModal({
  model,
  onClose,
  onConfirm,
}: {
  model: Model;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Delete Model" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
          <ModelAvatar model={model} size="sm" />
          <p className="text-sm font-medium">{model.name}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          This action cannot be undone. All accounts linked to{" "}
          <strong className="text-foreground">{model.name}</strong> will also be deleted.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 bg-card border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 bg-danger hover:bg-danger/90 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   USERS TAB
───────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (user: Profile) => {
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setDeleteUser(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold">Team Members</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control access and permissions for your team
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No users yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first team member to get started.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">User</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Page Access</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const initials = user.full_name
                  ?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "U";
                const pageCount = user.role === "admin" ? ALL_PAGES.length : user.allowed_pages.length;

                return (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0 hover:bg-card-hover transition-colors animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xs font-bold text-accent-light shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                        user.role === "admin"
                          ? "bg-accent/10 text-accent-light border-accent/20"
                          : "bg-muted-foreground/10 text-muted-foreground border-border"
                      )}>
                        {user.role === "admin" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {user.role === "admin" ? (
                        <span className="text-xs text-muted-foreground">All pages</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.allowed_pages.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No access</span>
                          ) : (
                            user.allowed_pages.slice(0, 3).map((p) => {
                              const page = ALL_PAGES.find((pg) => pg.id === p);
                              return (
                                <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-background border border-border text-muted">
                                  {page?.label ?? p}
                                </span>
                              );
                            })
                          )}
                          {user.allowed_pages.length > 3 && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-background border border-border text-muted-foreground">
                              +{user.allowed_pages.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {pageCount}/{ALL_PAGES.length} pages
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setEditUser(user)}
                          className="w-8 h-8 rounded-lg hover:bg-background border border-transparent hover:border-border flex items-center justify-center transition-all"
                          title="Edit permissions"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => setDeleteUser(user)}
                          className="w-8 h-8 rounded-lg hover:bg-danger/10 border border-transparent hover:border-danger/20 flex items-center justify-center transition-all"
                          title="Delete user"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
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

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { fetchUsers(); setShowAddModal(false); }}
        />
      )}
      {editUser && (
        <EditPermissionsModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => { fetchUsers(); setEditUser(null); }}
        />
      )}
      {deleteUser && (
        <ConfirmDeleteModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={() => handleDelete(deleteUser)}
        />
      )}
    </>
  );
}

/* ─── API Tab ─── */
function ApiTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
        <Plug className="w-7 h-7 text-accent" />
      </div>
      <h3 className="text-base font-semibold">API Configuration</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        API keys, webhooks and integrations will be configurable here in a future update.
      </p>
      <span className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent-light border border-accent/20 font-medium">
        Coming soon
      </span>
    </div>
  );
}

/* ─── Add User Modal ─── */
function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [allowedPages, setAllowedPages] = useState<string[]>(["dashboard"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const togglePage = (id: string) =>
    setAllowedPages((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, role, allowed_pages: role === "admin" ? [] : allowedPages }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Something went wrong.");
    else setCreated({ password: data.temp_password });
    setLoading(false);
  };

  const copyCredentials = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${created?.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (created) {
    return (
      <Modal title="User created!" onClose={onSuccess}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share these credentials with <strong className="text-foreground">{fullName || email}</strong>.
          </p>
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <CredentialRow label="Email" value={email} />
            <CredentialRow label="Password" value={created.password} mono />
          </div>
          <button onClick={copyCredentials} className="w-full h-10 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent-light text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors">
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy credentials</>}
          </button>
          <button onClick={onSuccess} className="w-full h-10 bg-accent hover:bg-accent-dark text-white text-sm font-semibold rounded-lg transition-colors">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add Team Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name">
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required className={inputCls} />
        </Field>
        <Field label="Email address">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@majest.agency" required className={inputCls} />
        </Field>
        <Field label="Role">
          <div className="grid grid-cols-2 gap-2">
            {(["user", "admin"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} className={cn("h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all", role === r ? "bg-accent border-accent text-white" : "bg-card border-border text-muted hover:border-border-light")}>
                {r === "admin" ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          {role === "admin" && (
            <p className="text-xs text-warning mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Admins have full access to all pages and settings.
            </p>
          )}
        </Field>
        {role === "user" && (
          <Field label="Page access">
            <div className="space-y-2">
              {ALL_PAGES.map((page) => {
                const Icon = page.icon;
                const checked = allowedPages.includes(page.id);
                return (
                  <label key={page.id} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all", checked ? "bg-accent/10 border-accent/30 text-foreground" : "bg-background border-border text-muted hover:border-border-light")}>
                    <input type="checkbox" checked={checked} onChange={() => togglePage(page.id)} className="sr-only" />
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all", checked ? "bg-accent border-accent" : "border-border")}>
                      {checked && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <Icon className={cn("w-4 h-4 shrink-0", checked ? "text-accent" : "text-muted-foreground")} />
                    <span className="text-sm">{page.label}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
        <button type="submit" disabled={loading} className="w-full h-11 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Plus className="w-4 h-4" /> Create User</>}
        </button>
      </form>
    </Modal>
  );
}

/* ─── Edit Permissions Modal ─── */
function EditPermissionsModal({ user, onClose, onSuccess }: { user: Profile; onClose: () => void; onSuccess: () => void }) {
  const [role, setRole] = useState<"admin" | "user">(user.role);
  const [allowedPages, setAllowedPages] = useState<string[]>(user.allowed_pages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const togglePage = (id: string) =>
    setAllowedPages((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, allowed_pages: role === "admin" ? [] : allowedPages }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Something went wrong.");
    else onSuccess();
    setLoading(false);
  };

  const initials = user.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "U";

  return (
    <Modal title="Edit Permissions" onClose={onClose}>
      <div className="flex items-center gap-3 mb-5 p-3 bg-background rounded-lg border border-border">
        <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xs font-bold text-accent-light shrink-0">{initials}</div>
        <div>
          <p className="text-sm font-medium">{user.full_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Role">
          <div className="grid grid-cols-2 gap-2">
            {(["user", "admin"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} className={cn("h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all", role === r ? "bg-accent border-accent text-white" : "bg-card border-border text-muted hover:border-border-light")}>
                {r === "admin" ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </Field>
        {role === "user" && (
          <Field label="Page access">
            <div className="space-y-2">
              {ALL_PAGES.map((page) => {
                const Icon = page.icon;
                const checked = allowedPages.includes(page.id);
                return (
                  <label key={page.id} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all", checked ? "bg-accent/10 border-accent/30 text-foreground" : "bg-background border-border text-muted hover:border-border-light")}>
                    <input type="checkbox" checked={checked} onChange={() => togglePage(page.id)} className="sr-only" />
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all", checked ? "bg-accent border-accent" : "border-border")}>
                      {checked && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <Icon className={cn("w-4 h-4 shrink-0", checked ? "text-accent" : "text-muted-foreground")} />
                    <span className="text-sm">{page.label}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
        <button type="submit" disabled={loading} className="w-full h-11 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Changes"}
        </button>
      </form>
    </Modal>
  );
}

/* ─── Confirm Delete User ─── */
function ConfirmDeleteModal({ user, onClose, onConfirm }: { user: Profile; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal title="Remove User" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Are you sure you want to remove <strong className="text-foreground">{user.full_name ?? user.email}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-card border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 h-10 bg-danger hover:bg-danger/90 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
            <Trash2 className="w-4 h-4" /> Remove
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Primitives ─── */
const inputCls = "w-full h-11 px-4 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-2xl w-full max-w-md p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-card flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function CredentialRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-sm font-medium truncate", mono && "font-mono text-accent-light")}>{value}</span>
    </div>
  );
}
