"use client";

import { useState } from "react";
import { X, Link2, Loader2 } from "lucide-react";

interface AddReelModalProps {
  onClose: () => void;
  onSubmit: (url: string, accountName: string) => void;
}

export function AddReelModal({ onClose, onSubmit }: AddReelModalProps) {
  const [url, setUrl] = useState("");
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !accountName) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    onSubmit(url, accountName);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-background border border-border rounded-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Analyser un Reel</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-card flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">URL du Reel Instagram</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://instagram.com/reel/..."
                className="w-full h-11 pl-10 pr-4 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Nom du compte</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="@model_name"
              className="w-full h-11 px-4 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !url || !accountName}
            className="w-full h-11 bg-accent hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              "Lancer l'analyse"
            )}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          L&apos;analyse décompose le hook, la structure, l&apos;audio, les textes et le CTA du Reel.
        </p>
      </div>
    </div>
  );
}
