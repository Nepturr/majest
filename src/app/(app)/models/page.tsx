"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { ProtectedPage } from "@/components/protected-page";
import { cn } from "@/lib/utils";
import type { Model } from "@/types";
import { Sparkles, Loader2, ImageOff } from "lucide-react";

function ModelAvatar({ model }: { model: Model }) {
  const [imgError, setImgError] = useState(false);

  if (model.avatar_url && !imgError) {
    return (
      <img
        src={model.avatar_url}
        alt={model.name}
        onError={() => setImgError(true)}
        className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
      />
    );
  }

  return (
    <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
      {model.avatar_url && imgError ? (
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      ) : (
        <span className="text-lg font-bold text-accent-light">
          {model.name[0].toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/models")
      .then((r) => r.json())
      .then((d) => { setModels(d.models ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <ProtectedPage pageId="models">
      <Header title="Models" subtitle="AI personas and associated accounts" />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-24 bg-card border border-border rounded-xl">
            <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No models yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              An admin can add models from the Admin panel.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {models.map((model, i) => (
              <div
                key={model.id}
                className="bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-border-light transition-all animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-4">
                  <ModelAvatar model={model} />
                  <div>
                    <h3 className="font-semibold">{model.name}</h3>
                    {model.persona && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-sm truncate">
                        {model.persona}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {model.lora_id && (
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground mb-1">LoRA</p>
                      <code className="text-xs text-accent-light bg-accent/10 border border-accent/20 px-2 py-0.5 rounded font-mono">
                        {model.lora_id}
                      </code>
                    </div>
                  )}
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                    model.status === "active"
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-muted-foreground/10 text-muted-foreground border-border"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      model.status === "active" ? "bg-success" : "bg-muted-foreground"
                    )} />
                    {model.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
