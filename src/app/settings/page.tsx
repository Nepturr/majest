"use client";

import { Header } from "@/components/header";
import { Database, Globe, Key, Bell } from "lucide-react";

export default function SettingsPage() {
  return (
    <>
      <Header title="Paramètres" subtitle="Configuration de MajestGPT" />

      <div className="p-6 space-y-6 max-w-2xl">
        <SettingSection icon={Database} title="Base de données" description="Supabase">
          <div className="space-y-3">
            <SettingField label="URL Supabase" placeholder="https://xxx.supabase.co" type="url" />
            <SettingField label="Anon Key" placeholder="eyJ..." type="password" />
          </div>
        </SettingSection>

        <SettingSection icon={Globe} title="Instagram API" description="Connexion API">
          <div className="space-y-3">
            <SettingField label="Access Token" placeholder="IGQ..." type="password" />
            <SettingField label="App ID" placeholder="123456789" />
          </div>
        </SettingSection>

        <SettingSection icon={Bell} title="Notifications" description="Alertes et rappels">
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Nouveau Reel analysé</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-accent" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Score en baisse</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-accent" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Rapport hebdomadaire</span>
              <input type="checkbox" className="w-4 h-4 rounded accent-accent" />
            </label>
          </div>
        </SettingSection>

        <SettingSection icon={Key} title="Équipe" description="Gestion des accès">
          <p className="text-sm text-muted-foreground">
            La gestion des membres de l&apos;équipe sera disponible dans une prochaine mise à jour.
          </p>
        </SettingSection>
      </div>
    </>
  );
}

function SettingSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-accent-glow border border-accent/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SettingField({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
      />
    </div>
  );
}
