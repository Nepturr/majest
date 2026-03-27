"use client";

import { Header } from "@/components/header";
import { ProtectedPage } from "@/components/protected-page";
import { Smartphone, Wifi, WifiOff } from "lucide-react";

export default function PhonePage() {
  return (
    <ProtectedPage pageId="phone">
      <div className="flex flex-col h-full min-h-0">
        <Header
          title="Phone"
          subtitle="Remote control of your phone farm"
        />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-accent-light" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold">Phone Farm</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Post and interact directly from your remote phones. Connection details coming soon.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-card border border-border rounded-full px-4 py-1.5">
              <WifiOff className="w-3.5 h-3.5" />
              No devices connected yet
            </div>
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
