import { ReelAnalysis, DashboardStats } from "@/types";

export const mockStats: DashboardStats = {
  total_reels_analyzed: 47,
  avg_score: 72,
  top_hook_type: "question",
  total_accounts: 12,
};

export const mockReels: ReelAnalysis[] = [
  {
    id: "1",
    url: "https://instagram.com/reel/example1",
    account_name: "model_luna",
    analyzed_at: "2026-03-24T14:30:00Z",
    duration_seconds: 15,
    hook: {
      text: "POV: You just discovered my page...",
      duration_seconds: 2.5,
      type: "visual",
      score: 85,
    },
    structure: {
      segments: [
        { label: "Hook", start_seconds: 0, end_seconds: 2.5, description: "Visual face-cam opener" },
        { label: "Build-up", start_seconds: 2.5, end_seconds: 8, description: "Zoom transition effect" },
        { label: "Reveal", start_seconds: 8, end_seconds: 12, description: "Visual intensity peak" },
        { label: "CTA", start_seconds: 12, end_seconds: 15, description: "Text overlay call-to-action" },
      ],
      pacing: "fast",
      transitions: ["zoom", "cut", "fade"],
    },
    audio: {
      type: "trending_sound",
      name: "Original Sound - viral_audio",
      has_voiceover: false,
    },
    text_overlays: {
      count: 3,
      items: [
        { text: "POV: You just discovered my page...", timestamp_seconds: 0, style: "bold-center" },
        { text: "Wait for it... 👀", timestamp_seconds: 5, style: "small-bottom" },
        { text: "Link in bio 🔗", timestamp_seconds: 13, style: "bold-center" },
      ],
    },
    cta: {
      present: true,
      type: "link",
      text: "Link in bio 🔗",
      placement: "end",
    },
    overall_score: 82,
    tags: ["pov", "transition", "trending-audio", "link-in-bio"],
    notes: "Strong visual hook. Fast pacing keeps attention. Clear CTA at the end.",
  },
  {
    id: "2",
    url: "https://instagram.com/reel/example2",
    account_name: "model_victoria",
    analyzed_at: "2026-03-23T10:15:00Z",
    duration_seconds: 30,
    hook: {
      text: "What would you do if I told you...",
      duration_seconds: 3,
      type: "question",
      score: 78,
    },
    structure: {
      segments: [
        { label: "Hook", start_seconds: 0, end_seconds: 3, description: "Direct question to camera" },
        { label: "Storytelling", start_seconds: 3, end_seconds: 15, description: "Narration with varied shots" },
        { label: "Climax", start_seconds: 15, end_seconds: 25, description: "High point with rising music" },
        { label: "CTA", start_seconds: 25, end_seconds: 30, description: "Follow invitation" },
      ],
      pacing: "medium",
      transitions: ["swipe", "cut"],
    },
    audio: {
      type: "voiceover",
      has_voiceover: true,
    },
    text_overlays: {
      count: 2,
      items: [
        { text: "What would you do?", timestamp_seconds: 0, style: "bold-center" },
        { text: "Follow for more ✨", timestamp_seconds: 26, style: "bold-bottom" },
      ],
    },
    cta: {
      present: true,
      type: "follow",
      text: "Follow for more ✨",
      placement: "end",
    },
    overall_score: 68,
    tags: ["question-hook", "storytelling", "voiceover", "follow-cta"],
    notes: "Good storytelling but hook could be punchier. 30s duration risks drop-off.",
  },
  {
    id: "3",
    url: "https://instagram.com/reel/example3",
    account_name: "model_luna",
    analyzed_at: "2026-03-22T16:45:00Z",
    duration_seconds: 8,
    hook: {
      text: "😱 Nobody expected this...",
      duration_seconds: 1.5,
      type: "shock",
      score: 91,
    },
    structure: {
      segments: [
        { label: "Hook", start_seconds: 0, end_seconds: 1.5, description: "Immediate shock reaction" },
        { label: "Content", start_seconds: 1.5, end_seconds: 6, description: "Fast content with cuts" },
        { label: "End", start_seconds: 6, end_seconds: 8, description: "Abrupt ending for replay" },
      ],
      pacing: "fast",
      transitions: ["jump-cut", "flash"],
    },
    audio: {
      type: "trending_sound",
      name: "Suspense Build - TikTok Remix",
      has_voiceover: false,
    },
    text_overlays: {
      count: 1,
      items: [
        { text: "😱 Nobody expected this...", timestamp_seconds: 0, style: "large-center" },
      ],
    },
    cta: {
      present: false,
    },
    overall_score: 75,
    tags: ["shock-hook", "short-form", "replay-bait", "no-cta"],
    notes: "Excellent shock hook. Ultra-short format encourages replay. Missing CTA = missed opportunity.",
  },
];
