export interface ReelAnalysis {
  id: string;
  url: string;
  thumbnail_url?: string;
  account_name: string;
  analyzed_at: string;
  duration_seconds: number;
  hook: {
    text: string;
    duration_seconds: number;
    type: "question" | "statement" | "shock" | "visual" | "trend";
    score: number;
  };
  structure: {
    segments: ReelSegment[];
    pacing: "slow" | "medium" | "fast" | "mixed";
    transitions: string[];
  };
  audio: {
    type: "trending_sound" | "original" | "voiceover" | "mixed";
    name?: string;
    has_voiceover: boolean;
  };
  text_overlays: {
    count: number;
    items: { text: string; timestamp_seconds: number; style: string }[];
  };
  cta: {
    present: boolean;
    type?: "follow" | "link" | "comment" | "share" | "custom";
    text?: string;
    placement?: "beginning" | "middle" | "end";
  };
  overall_score: number;
  tags: string[];
  notes?: string;
}

export interface ReelSegment {
  label: string;
  start_seconds: number;
  end_seconds: number;
  description: string;
}

export interface DashboardStats {
  total_reels_analyzed: number;
  avg_score: number;
  top_hook_type: string;
  total_accounts: number;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}
