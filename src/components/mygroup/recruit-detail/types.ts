import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";

export interface RecruitRepData {
  id: string;
  user_id?: string;
  year?: string;
  onboarding_complete?: boolean;
  trainings_complete?: boolean;
  slack_joined?: boolean;
  ramp_phase_1_complete?: boolean;
  ramp_phase_2_complete?: boolean;
  ramp_phase_3_complete?: boolean;
  ramp_phase_4_complete?: boolean;
  ipad_assigned?: boolean;
  committed_blitzes?: string[] | { id: string }[];
  blitz_trip_date?: string;
  blitz_trip_end_date?: string;
  blitz_trip_name?: string;
  blitz_trip_location?: string;
  notion_page_id?: string;
  watched_videos?: string[];
  efp_mode_enabled?: boolean;
}

export interface RecruitGoals {
  preseason_fp_goal?: number;
  training_hours_goal?: number;
  training_hours_progress?: number;
  books_goal?: number;
  books_progress?: number;
  role_plays_goal?: number;
  role_plays_progress?: number;
  blitzes_goal?: number;
  blitzes_progress?: number;
  must_do_fp_goal?: number;
  will_do_fp_goal?: number;
  could_do_fp_goal?: number;
  setup_complete?: boolean;
  focus_tier?: string;
}

export interface RecruitSummerConfig {
  personalSummerStart: string | null;
  personalSummerEnd: string | null;
  excludedSummerDays: string[];
}

export interface ContactForHelp {
  name: string;
  phone: string | null;
  id: string | null;
  role: 'leader' | 'recruiter';
}

export interface FocusIssue {
  priority: number;
  type: 'critical' | 'high' | 'medium' | 'low';
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionTab?: 'progress' | 'activity' | 'details';
}

export type TabType = 'progress' | 'activity' | 'details';
