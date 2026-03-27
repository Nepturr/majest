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
  latest_snapshot?: {
    followers_count: number | null;
    following_count: number | null;
    posts_count: number | null;
    profile_pic_url: string | null;
    collected_at: string;
  } | null;
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

// ── Instagram Analytics ────────────────────────────────────────

/** Snapshot des métriques d'un compte Instagram à un instant T */
export interface InstagramAccountSnapshot {
  id: string;
  instagram_account_id: string;
  followers_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  bio: string | null;
  is_verified: boolean;
  profile_pic_url: string | null;
  apify_run_id: string | null;
  collected_at: string;
}

/** Structure invariante d'un post/reel Instagram */
export interface InstagramPost {
  id: string;
  instagram_account_id: string;
  shortcode: string;
  post_type: "Image" | "Video" | "Sidecar";
  url: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  first_seen_at: string;
  updated_at: string;
  /** Dernier snapshot de métriques (joint depuis instagram_post_snapshots) */
  latest_snapshot?: InstagramPostSnapshot | null;
}

/** Métriques d'un post Instagram à un instant T */
export interface InstagramPostSnapshot {
  id: string;
  post_id: string;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  plays_count: number | null;
  apify_run_id: string | null;
  collected_at: string;
}

/** Résultat d'un run de collecte Apify */
export interface ApifyCollectResult {
  runId: string;
  status: "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "ABORTING" | "ABORTED" | "TIMING-OUT" | "TIMED-OUT";
  datasetId: string | null;
  snapshotSaved: boolean;
  postsSaved: number;
  finishedAt: string | null;
}
