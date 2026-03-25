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

export interface Model {
  id: string;
  name: string;
  avatar_url: string | null;
  persona: string | null;
  lora_id: string | null;
  brand_notes: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  model_id: string;
  ofapi_account_id: string | null;
  of_username: string | null;
  of_avatar_url: string | null;
  instagram_handle: string | null;
  niche: string | null;
  get_my_social_link_id: string | null;
  of_tracking_link: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface InstagramAccount {
  id: string;
  model_id: string;
  of_account_id: string | null;
  instagram_handle: string;
  oneup_social_network_id: string | null;
  oneup_social_network_name: string | null;
  oneup_category_id: string | null;
  get_my_social_link_id: string | null;
  get_my_social_link_name: string | null;
  of_tracking_link_id: string | null;
  of_tracking_link_url: string | null;
  niche: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  // Joined fields (from API)
  model?: { name: string; avatar_url: string | null };
  of_account?: { of_username: string | null; of_avatar_url: string | null };
}

/** A social account from the OneUp API (Instagram filtered) */
export interface OneUpSocialAccount {
  social_network_id: string;
  social_network_name: string;
  category_id: string;
  category_name: string;
  is_expired: boolean;
  isAssigned: boolean;
}

/** A link from the GetMySocial API */
export interface GMSLink {
  id: string;          // _id from GMS
  title: string;
  url: string | null;
  isAssigned: boolean;
}

/** A tracking link from the OnlyFansAPI */
export interface OFTrackingLink {
  id: string;
  name: string;
  url: string | null;
  isAssigned: boolean;
}

/** A connected OnlyFans account from the OFAPI console */
export interface OFApiAccount {
  id: string;          // e.g. "acct_XXXXXXXX"
  username: string;
  name: string | null;
  avatar: string | null;
  isAssigned: boolean;
  assignedToModelId: string | null;
  assignedToModelName: string | null;
}
