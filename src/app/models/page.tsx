"use client";

import { Header } from "@/components/header";
import { Users, Film, TrendingUp, Star } from "lucide-react";

const models = [
  { name: "Luna", handle: "@model_luna", reels: 28, avgScore: 79, status: "active" },
  { name: "Victoria", handle: "@model_victoria", reels: 15, avgScore: 68, status: "active" },
  { name: "Sophia", handle: "@model_sophia", reels: 4, avgScore: 55, status: "onboarding" },
];

export default function ModelsPage() {
  return (
    <>
      <Header title="Modèles" subtitle="Gestion des comptes et performances" />

      <div className="p-6 space-y-4">
        {models.map((model, i) => (
          <div
            key={model.handle}
            className="bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-border-light transition-all animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center text-white font-bold text-lg">
                {model.name[0]}
              </div>
              <div>
                <h3 className="font-semibold">{model.name}</h3>
                <p className="text-sm text-muted-foreground">{model.handle}</p>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Reels</p>
                <p className="text-lg font-bold flex items-center gap-1">
                  <Film className="w-4 h-4 text-accent" />
                  {model.reels}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Score moyen</p>
                <p className="text-lg font-bold flex items-center gap-1">
                  <Star className="w-4 h-4 text-warning" />
                  {model.avgScore}
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full border ${
                model.status === "active"
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-warning/10 text-warning border-warning/20"
              }`}>
                {model.status === "active" ? "Actif" : "Onboarding"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
