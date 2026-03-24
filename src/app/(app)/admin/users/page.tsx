"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { ALL_PAGES } from "@/lib/pages";
import { cn } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, Shield, User, Copy, Check,
  X, Loader2, AlertCircle, KeyRound,
} from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  allowed_pages: string[];
  created_at: string;
}

export default function AdminUsersPage() {
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
      <Header
        title="User Management"
        subtitle="Control access and permissions for your team"
        action={{ label: "Add User", onClick: () => setShowAddModal(true) }}
      />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-sm">No users yet. Add your first team member.</p>
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
                      className={cn("border-b border-border last:border-0 hover:bg-card-hover transition-colors animate-fade-in")}
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
                        {new Date(user.created_at).toLocaleDateString()}
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
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-danger" />
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

  const togglePage = (id: string) => {
    setAllowedPages((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        full_name: fullName,
        role,
        allowed_pages: role === "admin" ? [] : allowedPages,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
    } else {
      setCreated({ password: data.temp_password });
    }
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
            Share these credentials with <strong className="text-foreground">{fullName || email}</strong>. They can change their password after logging in.
          </p>
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <CredentialRow label="Email" value={email} />
            <CredentialRow label="Password" value={created.password} mono />
          </div>
          <button
            onClick={copyCredentials}
            className="w-full h-10 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent-light text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy credentials</>}
          </button>
          <button
            onClick={onSuccess}
            className="w-full h-10 bg-accent hover:bg-accent-dark text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add Team Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            required
            className={inputCls}
          />
        </Field>

        <Field label="Email address">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@majest.agency"
            required
            className={inputCls}
          />
        </Field>

        <Field label="Role">
          <div className="grid grid-cols-2 gap-2">
            {(["user", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all",
                  role === r
                    ? "bg-accent border-accent text-white"
                    : "bg-card border-border text-muted hover:border-border-light"
                )}
              >
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
                  <label
                    key={page.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                      checked
                        ? "bg-accent/10 border-accent/30 text-foreground"
                        : "bg-background border-border text-muted hover:border-border-light"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePage(page.id)}
                      className="sr-only"
                    />
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                      checked ? "bg-accent border-accent" : "border-border"
                    )}>
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
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4" /> Create User</>}
        </button>
      </form>
    </Modal>
  );
}

/* ─── Edit Permissions Modal ─── */
function EditPermissionsModal({ user, onClose, onSuccess }: {
  user: Profile; onClose: () => void; onSuccess: () => void;
}) {
  const [role, setRole] = useState<"admin" | "user">(user.role);
  const [allowedPages, setAllowedPages] = useState<string[]>(user.allowed_pages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const togglePage = (id: string) => {
    setAllowedPages((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

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
        <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xs font-bold text-accent-light shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium">{user.full_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Role">
          <div className="grid grid-cols-2 gap-2">
            {(["user", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all",
                  role === r ? "bg-accent border-accent text-white" : "bg-card border-border text-muted hover:border-border-light"
                )}
              >
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
                  <label
                    key={page.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                      checked ? "bg-accent/10 border-accent/30 text-foreground" : "bg-background border-border text-muted hover:border-border-light"
                    )}
                  >
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

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
        </button>
      </form>
    </Modal>
  );
}

/* ─── Confirm Delete Modal ─── */
function ConfirmDeleteModal({ user, onClose, onConfirm }: {
  user: Profile; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Modal title="Remove User" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Are you sure you want to remove <strong className="text-foreground">{user.full_name ?? user.email}</strong>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-card border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 h-10 bg-danger hover:bg-danger/90 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
            <Trash2 className="w-4 h-4" /> Remove
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Shared primitives ─── */
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
    <div className="space-y-2">
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
