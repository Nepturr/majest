"use client";

import { useState, useEffect, useCallback } from "react";
import type { Phone, PhoneGroup, PhoneAccess } from "@/types";
import {
  Plus, Pencil, Trash2, X, Loader2, AlertCircle, Check,
  Smartphone, Layers, Shield, User, Wifi, WifiOff, RefreshCw,
  CheckCircle2, Link2,
} from "lucide-react";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

const IPHONE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "iPhone 16 Pro Max": { width: 440, height: 956 },
  "iPhone 16 Pro":     { width: 402, height: 874 },
  "iPhone 16 Plus":    { width: 430, height: 932 },
  "iPhone 16":         { width: 393, height: 852 },
  "iPhone 15 Pro Max": { width: 430, height: 932 },
  "iPhone 15 Pro":     { width: 393, height: 852 },
  "iPhone 15 Plus":    { width: 430, height: 932 },
  "iPhone 15":         { width: 393, height: 852 },
  "iPhone 14 Pro Max": { width: 430, height: 932 },
  "iPhone 14 Pro":     { width: 393, height: 852 },
  "iPhone 14 Plus":    { width: 428, height: 926 },
  "iPhone 14":         { width: 390, height: 844 },
  "iPhone 13 Pro Max": { width: 428, height: 926 },
  "iPhone 13 Pro":     { width: 390, height: 844 },
  "iPhone 13":         { width: 390, height: 844 },
  "iPhone 13 mini":    { width: 375, height: 812 },
  "iPhone 12 Pro Max": { width: 428, height: 926 },
  "iPhone 12 Pro":     { width: 390, height: 844 },
  "iPhone 12":         { width: 390, height: 844 },
  "iPhone 12 mini":    { width: 375, height: 812 },
  "iPhone 11 Pro Max": { width: 414, height: 896 },
  "iPhone 11 Pro":     { width: 375, height: 812 },
  "iPhone 11":         { width: 414, height: 896 },
  "iPhone XS Max":     { width: 414, height: 896 },
  "iPhone XS":         { width: 375, height: 812 },
  "iPhone XR":         { width: 414, height: 896 },
  "iPhone X":          { width: 375, height: 812 },
  "iPhone SE (3ème gen)": { width: 375, height: 667 },
  "iPhone SE (2ème gen)": { width: 375, height: 667 },
};

const GROUP_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#64748b",
];

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
}

/* ─── Tabs ─── */
const TABS = [
  { id: "devices", label: "Devices", icon: Smartphone },
  { id: "groups", label: "Groups", icon: Layers },
  { id: "access", label: "Access", icon: Shield },
  { id: "connection", label: "Connection", icon: Wifi },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* ═══════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════ */
export function PhoneConfigContent() {
  const [activeTab, setActiveTab] = useState<TabId>("devices");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="border-b border-border px-1 shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                  active ? "border-accent text-accent-light" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "devices" && <DevicesTab />}
        {activeTab === "groups" && <GroupsTab />}
        {activeTab === "access" && <AccessTab />}
        {activeTab === "connection" && <ConnectionTab />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DEVICES TAB
═══════════════════════════════════════════ */
function DevicesTab() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [groups, setGroups] = useState<PhoneGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPhone, setEditPhone] = useState<Phone | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [phonesRes, groupsRes] = await Promise.all([
      fetch("/api/admin/phones").then((r) => r.json()),
      fetch("/api/admin/phone-groups").then((r) => r.json()),
    ]);
    setPhones(phonesRes.phones ?? []);
    setGroups(groupsRes.groups ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this phone and all its access entries?")) return;
    setDeletingId(id);
    await fetch(`/api/admin/phones/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Devices</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Register iPhones by MAC address</p>
        </div>
        <button
          onClick={() => { setEditPhone(null); setShowModal(true); }}
          className="h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Device
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : phones.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Smartphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No devices yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add an iPhone by its MAC address.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Label</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">MAC Address</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Model</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Group</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {phones.map((phone) => {
                const grp = phone.group as PhoneGroup | null;
                return (
                  <tr key={phone.id} className="hover:bg-background/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{phone.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{phone.device_id}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {phone.model ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {grp ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${grp.color}20`, color: grp.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: grp.color }} />
                          {grp.name}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
                        phone.status === "active" ? "bg-success/10 text-success" : "bg-muted-foreground/10 text-muted-foreground"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", phone.status === "active" ? "bg-success" : "bg-muted-foreground")} />
                        {phone.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditPhone(phone); setShowModal(true); }} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(phone.id)} disabled={deletingId === phone.id} className="w-7 h-7 rounded-lg hover:bg-danger/10 flex items-center justify-center">
                          {deletingId === phone.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />}
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

      {showModal && (
        <PhoneFormModal
          phone={editPhone}
          groups={groups}
          onClose={() => { setShowModal(false); setEditPhone(null); }}
          onSuccess={() => { setShowModal(false); setEditPhone(null); load(); }}
        />
      )}
    </>
  );
}

/* ─── Phone Form Modal ─── */
function PhoneFormModal({ phone, groups, onClose, onSuccess }: {
  phone: Phone | null;
  groups: PhoneGroup[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!phone;
  const [label, setLabel] = useState(phone?.label ?? "");
  const [deviceId, setDeviceId] = useState(phone?.device_id ?? "");
  const [groupId, setGroupId] = useState(phone?.group_id ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(phone?.status ?? "active");
  const [model, setModel] = useState(phone?.model ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const dims = model ? IPHONE_DIMENSIONS[model] ?? null : null;
    const payload = {
      label: label.trim(),
      device_id: deviceId.trim().toUpperCase(),
      group_id: groupId || null,
      status,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      model: model || null,
    };
    const url = isEdit ? `/api/admin/phones/${phone!.id}` : "/api/admin/phones";
    const res = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">{isEdit ? "Edit Device" : "Add Device"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted-foreground/10"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <FormField label="Label *">
            <input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="iPhone 1" className={inputCls} />
          </FormField>
          <FormField label="MAC Address *">
            <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} required placeholder="AA:BB:CC:DD:EE:FF" disabled={isEdit} className={cn(inputCls, isEdit && "opacity-60 cursor-not-allowed")} />
          </FormField>
          <FormField label="Group">
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
              <option value="">No group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </FormField>
          <FormField label="Model">
            <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
              <option value="">Select a model…</option>
              {Object.keys(IPHONE_DIMENSIONS).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {model && IPHONE_DIMENSIONS[model] && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {IPHONE_DIMENSIONS[model].width} × {IPHONE_DIMENSIONS[model].height} px
              </p>
            )}
          </FormField>
          <FormField label="Status">
            <div className="grid grid-cols-2 gap-2">
              {(["active", "inactive"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={cn("h-9 rounded-lg border text-sm font-medium transition-all", status === s ? "bg-accent border-accent text-white" : "border-border text-muted-foreground hover:border-accent/40")}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </FormField>
          {error && <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-9 border border-border rounded-lg text-sm hover:bg-card-hover transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-9 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Save" : "Add Device"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   GROUPS TAB
═══════════════════════════════════════════ */
function GroupsTab() {
  const [groups, setGroups] = useState<PhoneGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState<PhoneGroup | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/admin/phone-groups").then((r) => r.json());
    setGroups(data.groups ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (group: PhoneGroup) => {
    if (group.phone_count && group.phone_count > 0) {
      if (!confirm(`This group has ${group.phone_count} device(s). They will be unassigned. Continue?`)) return;
    }
    setDeletingId(group.id);
    await fetch(`/api/admin/phone-groups/${group.id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Groups</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Organize devices into logical groups for easier access management</p>
        </div>
        <button onClick={() => { setEditGroup(null); setShowModal(true); }} className="h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Add Group
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No groups yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create groups to bundle devices together.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl hover:border-border-light transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${group.color}25`, border: `1px solid ${group.color}50` }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{group.name}</p>
                <p className="text-xs text-muted-foreground">{group.phone_count ?? 0} device{(group.phone_count ?? 0) !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditGroup(group); setShowModal(true); }} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(group)} disabled={deletingId === group.id} className="w-7 h-7 rounded-lg hover:bg-danger/10 flex items-center justify-center">
                  {deletingId === group.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GroupFormModal
          group={editGroup}
          onClose={() => { setShowModal(false); setEditGroup(null); }}
          onSuccess={() => { setShowModal(false); setEditGroup(null); load(); }}
        />
      )}
    </>
  );
}

function GroupFormModal({ group, onClose, onSuccess }: { group: PhoneGroup | null; onClose: () => void; onSuccess: () => void }) {
  const isEdit = !!group;
  const [name, setName] = useState(group?.name ?? "");
  const [color, setColor] = useState(group?.color ?? "#6366f1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const url = isEdit ? `/api/admin/phone-groups/${group!.id}` : "/api/admin/phone-groups";
    const res = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), color }) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Error"); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">{isEdit ? "Edit Group" : "New Group"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted-foreground/10"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <FormField label="Group name *">
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="VA Team" className={inputCls} />
          </FormField>
          <FormField label="Color">
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={cn("w-7 h-7 rounded-full transition-all", color === c && "ring-2 ring-white ring-offset-2 ring-offset-card")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </FormField>
          {error && <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-9 border border-border rounded-lg text-sm hover:bg-card-hover">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-9 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ACCESS TAB
═══════════════════════════════════════════ */
function AccessTab() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [groups, setGroups] = useState<PhoneGroup[]>([]);
  const [access, setAccess] = useState<PhoneAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, phonesRes, groupsRes, accessRes] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/phones").then((r) => r.json()),
      fetch("/api/admin/phone-groups").then((r) => r.json()),
      fetch("/api/admin/phone-access").then((r) => r.json()),
    ]);
    // Show only non-admin users
    setUsers((usersRes.users ?? []).filter((u: Profile) => u.role !== "admin"));
    setPhones(phonesRes.phones ?? []);
    setGroups(groupsRes.groups ?? []);
    setAccess(accessRes.access ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getUserAccess = (userId: string) =>
    access.filter((a) => a.user_id === userId);

  const grantAccess = async (userId: string, target: { phone_id?: string; group_id?: string }) => {
    await fetch("/api/admin/phone-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ...target }),
    });
    load();
  };

  const revokeAccess = async (accessId: string) => {
    await fetch(`/api/admin/phone-access/${accessId}`, { method: "DELETE" });
    load();
  };

  return (
    <>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Access Permissions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Admins have full access. Configure access for team members below.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm">No non-admin users yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const userAccess = getUserAccess(user.id);
            return (
              <div key={user.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background/40 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 text-xs font-bold text-accent-light">
                    {user.full_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {userAccess.length === 0 ? (
                      <span className="text-xs text-muted-foreground bg-border/50 px-2 py-0.5 rounded-full">No access</span>
                    ) : (
                      <span className="text-xs text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                        {userAccess.length} permission{userAccess.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </button>

                {selectedUser?.id === user.id && (
                  <div className="border-t border-border px-4 py-3 space-y-2 bg-background/20">
                    {/* Current accesses */}
                    {userAccess.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {userAccess.map((a) => {
                          const label = a.phone_id
                            ? `📱 ${(a.phone as Phone)?.label ?? a.phone_id}`
                            : `📦 ${(a.group as PhoneGroup)?.name ?? a.group_id}`;
                          const color = a.group_id ? (a.group as PhoneGroup)?.color : undefined;
                          return (
                            <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 bg-card border border-border rounded-lg">
                              {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                              {!color && <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />}
                              <span className="text-xs flex-1">{label}</span>
                              <button onClick={() => revokeAccess(a.id)} className="text-danger/70 hover:text-danger transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Grant access pickers */}
                    <div className="space-y-2">
                      {phones.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Individual Devices</p>
                          <div className="flex flex-wrap gap-1.5">
                            {phones.map((phone) => {
                              const hasAccess = userAccess.some((a) => a.phone_id === phone.id);
                              return (
                                <button
                                  key={phone.id}
                                  onClick={() => !hasAccess && grantAccess(user.id, { phone_id: phone.id })}
                                  disabled={hasAccess}
                                  className={cn(
                                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all",
                                    hasAccess ? "bg-success/10 border-success/30 text-success cursor-default" : "bg-card border-border hover:border-accent/40 cursor-pointer"
                                  )}
                                >
                                  {hasAccess ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                  {phone.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {groups.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Groups (all devices in group)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {groups.map((group) => {
                              const hasAccess = userAccess.some((a) => a.group_id === group.id);
                              return (
                                <button
                                  key={group.id}
                                  onClick={() => !hasAccess && grantAccess(user.id, { group_id: group.id })}
                                  disabled={hasAccess}
                                  className={cn(
                                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all",
                                    hasAccess ? "cursor-default" : "bg-card border-border hover:border-accent/40 cursor-pointer"
                                  )}
                                  style={hasAccess ? { backgroundColor: `${group.color}20`, borderColor: `${group.color}40`, color: group.color } : {}}
                                >
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                                  {hasAccess ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                  {group.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   CONNECTION TAB
═══════════════════════════════════════════ */
function ConnectionTab() {
  const [ip, setIp] = useState("");
  const [savedIp, setSavedIp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings?keys=mini_pc_ip")
      .then((r) => r.json())
      .then((d) => {
        const v = d.settings?.mini_pc_ip ?? "";
        setIp(v);
        setSavedIp(v);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "mini_pc_ip", value: ip.trim() }),
    });
    setSavedIp(ip.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/phones"); // just a quick test that the saved IP path works
      // Actually test the XP API connection
      const testRes = await fetch("/api/phone/farm-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: savedIp }),
      });
      const data = await testRes.json();
      if (testRes.ok && data.ok) {
        setTestResult({ ok: true, message: `Connected — ${data.deviceCount ?? 0} device${data.deviceCount !== 1 ? "s" : ""} found.` });
      } else {
        setTestResult({ ok: false, message: data.error ?? "Connection failed." });
      }
    } catch {
      setTestResult({ ok: false, message: "Connection failed." });
    }
    setTesting(false);
  };

  const isDirty = ip.trim() !== savedIp;

  return (
    <div className="max-w-md space-y-5">
      <div>
        <h3 className="text-sm font-semibold">iMouseXP Connection</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          IP address of your Mini PC running iMouseXP (port 9911).
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5 text-accent-light" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Mini PC</p>
            <p className="text-xs text-muted-foreground">NiPoGi H1 — iMouseXP Kernel</p>
          </div>
          {savedIp && !isDirty && (
            <span className="inline-flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/20 px-2.5 py-1 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Configured
            </span>
          )}
        </div>

        {loading ? (
          <div className="h-10 bg-background border border-border rounded-lg animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={ip}
              onChange={(e) => { setIp(e.target.value); setTestResult(null); }}
              placeholder="192.168.1.100"
              className="flex-1 h-10 px-3 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all placeholder:font-sans placeholder:text-muted-foreground"
            />
            <span className="text-xs text-muted-foreground shrink-0 font-mono">:9911</span>
          </div>
        )}

        {testResult && (
          <div className={cn("flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border", testResult.ok ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20")}>
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {testResult.message}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !ip.trim() || !isDirty} className="h-9 px-4 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? "Saved!" : "Save"}
          </button>
          <button onClick={handleTest} disabled={testing || !savedIp || isDirty} className="h-9 px-4 bg-card border border-border hover:bg-card-hover disabled:opacity-40 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors" title={isDirty ? "Save first" : ""}>
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
            Test connection
          </button>
        </div>
        {isDirty && savedIp && <p className="text-[11px] text-warning">Save the IP before testing.</p>}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Protocol</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><WifiOff className="w-3 h-3" /> HTTP POST — port 9911</div>
          <div className="flex items-center gap-1.5"><Wifi className="w-3 h-3" /> WebSocket — port 9911</div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Ensure the Mini PC is accessible from the Vercel backend via Tailscale or direct IP.
        </p>
      </div>
    </div>
  );
}

/* ─── Primitives ─── */
const inputCls = "w-full h-10 px-3 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
