export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_dismissed_issues: {
        Row: {
          admin_user_id: string
          dismissed_at: string
          entry_id: string
          id: string
          issue_id: string
        }
        Insert: {
          admin_user_id: string
          dismissed_at?: string
          entry_id: string
          id?: string
          issue_id: string
        }
        Update: {
          admin_user_id?: string
          dismissed_at?: string
          entry_id?: string
          id?: string
          issue_id?: string
        }
        Relationships: []
      }
      blitz_declines: {
        Row: {
          blitz_id: string
          declined_at: string | null
          declined_by: string | null
          id: string
          rep_notion_page_id: string
        }
        Insert: {
          blitz_id: string
          declined_at?: string | null
          declined_by?: string | null
          id?: string
          rep_notion_page_id: string
        }
        Update: {
          blitz_id?: string
          declined_at?: string | null
          declined_by?: string | null
          id?: string
          rep_notion_page_id?: string
        }
        Relationships: []
      }
      blitz_invites: {
        Row: {
          blitz_id: string
          contacted_at: string | null
          contacted_by: string | null
          id: string
          rep_notion_page_id: string
        }
        Insert: {
          blitz_id: string
          contacted_at?: string | null
          contacted_by?: string | null
          id?: string
          rep_notion_page_id: string
        }
        Update: {
          blitz_id?: string
          contacted_at?: string | null
          contacted_by?: string | null
          id?: string
          rep_notion_page_id?: string
        }
        Relationships: []
      }
      competitors: {
        Row: {
          alternate_versions: Json | null
          category: string | null
          created_at: string
          id: string
          main_image_url: string | null
          monitoring_companies: string[] | null
          name: string
          notion_page_id: string
          objections: Json | null
          our_selling_points: string[] | null
          their_selling_points: string[] | null
          updated_at: string
        }
        Insert: {
          alternate_versions?: Json | null
          category?: string | null
          created_at?: string
          id?: string
          main_image_url?: string | null
          monitoring_companies?: string[] | null
          name: string
          notion_page_id: string
          objections?: Json | null
          our_selling_points?: string[] | null
          their_selling_points?: string[] | null
          updated_at?: string
        }
        Update: {
          alternate_versions?: Json | null
          category?: string | null
          created_at?: string
          id?: string
          main_image_url?: string | null
          monitoring_companies?: string[] | null
          name?: string
          notion_page_id?: string
          objections?: Json | null
          our_selling_points?: string[] | null
          their_selling_points?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_entries: {
        Row: {
          break_periods: Json | null
          closes: number | null
          counter_timestamps: Json | null
          created_at: string | null
          custom_counters: Json | null
          decision_makers: number | null
          doors_knocked: number | null
          entry_date: string
          fp_plus: number | null
          id: string
          is_finalized: boolean | null
          notes: string | null
          pitches: number | null
          presentations: number | null
          prmr: number | null
          sales_log: Json | null
          timezone: string | null
          transitions: number | null
          updated_at: string | null
          upgrade_prmr: number | null
          user_id: string
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          break_periods?: Json | null
          closes?: number | null
          counter_timestamps?: Json | null
          created_at?: string | null
          custom_counters?: Json | null
          decision_makers?: number | null
          doors_knocked?: number | null
          entry_date: string
          fp_plus?: number | null
          id?: string
          is_finalized?: boolean | null
          notes?: string | null
          pitches?: number | null
          presentations?: number | null
          prmr?: number | null
          sales_log?: Json | null
          timezone?: string | null
          transitions?: number | null
          updated_at?: string | null
          upgrade_prmr?: number | null
          user_id: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          break_periods?: Json | null
          closes?: number | null
          counter_timestamps?: Json | null
          created_at?: string | null
          custom_counters?: Json | null
          decision_makers?: number | null
          doors_knocked?: number | null
          entry_date?: string
          fp_plus?: number | null
          id?: string
          is_finalized?: boolean | null
          notes?: string | null
          pitches?: number | null
          presentations?: number | null
          prmr?: number | null
          sales_log?: Json | null
          timezone?: string | null
          transitions?: number | null
          updated_at?: string | null
          upgrade_prmr?: number | null
          user_id?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: []
      }
      historical_entries: {
        Row: {
          closes: number | null
          created_at: string | null
          day_of_week: number
          decision_makers: number | null
          doors_knocked: number | null
          fp_plus: number | null
          hours_worked: number | null
          id: string
          original_date: string
          pitches: number | null
          presentations: number | null
          prmr: number | null
          season_type: string
          season_week: number
          season_year: number
          transitions: number | null
          upgrade_prmr: number | null
          user_id: string
        }
        Insert: {
          closes?: number | null
          created_at?: string | null
          day_of_week: number
          decision_makers?: number | null
          doors_knocked?: number | null
          fp_plus?: number | null
          hours_worked?: number | null
          id?: string
          original_date: string
          pitches?: number | null
          presentations?: number | null
          prmr?: number | null
          season_type: string
          season_week: number
          season_year: number
          transitions?: number | null
          upgrade_prmr?: number | null
          user_id: string
        }
        Update: {
          closes?: number | null
          created_at?: string | null
          day_of_week?: number
          decision_makers?: number | null
          doors_knocked?: number | null
          fp_plus?: number | null
          hours_worked?: number | null
          id?: string
          original_date?: string
          pitches?: number | null
          presentations?: number | null
          prmr?: number | null
          season_type?: string
          season_week?: number
          season_year?: number
          transitions?: number | null
          upgrade_prmr?: number | null
          user_id?: string
        }
        Relationships: []
      }
      note_tags: {
        Row: {
          created_at: string
          id: string
          note_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body_json: Json
          body_preview: string | null
          created_at: string
          id: string
          is_archived: boolean
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body_json?: Json
          body_preview?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body_json?: Json
          body_preview?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          entry_date: string
          id: string
          notification_type: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          entry_date: string
          id?: string
          notification_type: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          entry_date?: string
          id?: string
          notification_type?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      planned_work_days: {
        Row: {
          created_at: string | null
          id: string
          planned_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          planned_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          planned_date?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recruit_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["recruit_activity_type"]
          assigned_to_user_id: string | null
          assignment_status: string | null
          completed_at: string | null
          created_at: string
          id: string
          logged_by_user_id: string
          next_action: string | null
          next_action_due: string | null
          notes: string | null
          rep_notion_page_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["recruit_activity_type"]
          assigned_to_user_id?: string | null
          assignment_status?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          logged_by_user_id: string
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          rep_notion_page_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["recruit_activity_type"]
          assigned_to_user_id?: string | null
          assignment_status?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          logged_by_user_id?: string
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          rep_notion_page_id?: string
        }
        Relationships: []
      }
      recruit_suggestions: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          notion_page_id: string | null
          phone: string
          relationship: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
          suggested_by_name: string
          suggested_by_user_id: string
          team_leader_notion_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          notion_page_id?: string | null
          phone: string
          relationship?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggested_by_name: string
          suggested_by_user_id: string
          team_leader_notion_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          notion_page_id?: string | null
          phone?: string
          relationship?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggested_by_name?: string
          suggested_by_user_id?: string
          team_leader_notion_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rep_goals: {
        Row: {
          avg_prmr_per_fp: number | null
          blitzes_goal: number | null
          blitzes_progress: number | null
          books_committed: Json | null
          books_goal: number | null
          books_progress: number | null
          books_read: Json | null
          cancel_rate: number | null
          could_do_fp_goal: number | null
          created_at: string | null
          id: string
          last_training_date: string | null
          monday_night_lights_goal: number | null
          monday_night_lights_progress: number | null
          monthly_expenses: number | null
          months_off: number | null
          must_do_fp_goal: number | null
          other_books_committed: Json | null
          other_books_read: Json | null
          prep_score_history: Json | null
          preseason_fp_goal: number | null
          recruits_with_sale_goal: number | null
          recruits_with_sale_progress: number | null
          rent_type: string | null
          role_plays_goal: number | null
          role_plays_progress: number | null
          setup_complete: boolean | null
          training_hours_goal: number | null
          training_hours_history: Json | null
          training_hours_progress: number | null
          training_streak: number | null
          training_week_start: string | null
          updated_at: string | null
          upgrade_fp_goal: number | null
          user_id: string
          vet_earnings_per_efp: number | null
          weekly_mnl_logs: Json | null
          weekly_roleplay_logs: Json | null
          weeks_working: number | null
          will_do_fp_goal: number | null
        }
        Insert: {
          avg_prmr_per_fp?: number | null
          blitzes_goal?: number | null
          blitzes_progress?: number | null
          books_committed?: Json | null
          books_goal?: number | null
          books_progress?: number | null
          books_read?: Json | null
          cancel_rate?: number | null
          could_do_fp_goal?: number | null
          created_at?: string | null
          id?: string
          last_training_date?: string | null
          monday_night_lights_goal?: number | null
          monday_night_lights_progress?: number | null
          monthly_expenses?: number | null
          months_off?: number | null
          must_do_fp_goal?: number | null
          other_books_committed?: Json | null
          other_books_read?: Json | null
          prep_score_history?: Json | null
          preseason_fp_goal?: number | null
          recruits_with_sale_goal?: number | null
          recruits_with_sale_progress?: number | null
          rent_type?: string | null
          role_plays_goal?: number | null
          role_plays_progress?: number | null
          setup_complete?: boolean | null
          training_hours_goal?: number | null
          training_hours_history?: Json | null
          training_hours_progress?: number | null
          training_streak?: number | null
          training_week_start?: string | null
          updated_at?: string | null
          upgrade_fp_goal?: number | null
          user_id: string
          vet_earnings_per_efp?: number | null
          weekly_mnl_logs?: Json | null
          weekly_roleplay_logs?: Json | null
          weeks_working?: number | null
          will_do_fp_goal?: number | null
        }
        Update: {
          avg_prmr_per_fp?: number | null
          blitzes_goal?: number | null
          blitzes_progress?: number | null
          books_committed?: Json | null
          books_goal?: number | null
          books_progress?: number | null
          books_read?: Json | null
          cancel_rate?: number | null
          could_do_fp_goal?: number | null
          created_at?: string | null
          id?: string
          last_training_date?: string | null
          monday_night_lights_goal?: number | null
          monday_night_lights_progress?: number | null
          monthly_expenses?: number | null
          months_off?: number | null
          must_do_fp_goal?: number | null
          other_books_committed?: Json | null
          other_books_read?: Json | null
          prep_score_history?: Json | null
          preseason_fp_goal?: number | null
          recruits_with_sale_goal?: number | null
          recruits_with_sale_progress?: number | null
          rent_type?: string | null
          role_plays_goal?: number | null
          role_plays_progress?: number | null
          setup_complete?: boolean | null
          training_hours_goal?: number | null
          training_hours_history?: Json | null
          training_hours_progress?: number | null
          training_streak?: number | null
          training_week_start?: string | null
          updated_at?: string | null
          upgrade_fp_goal?: number | null
          user_id?: string
          vet_earnings_per_efp?: number | null
          weekly_mnl_logs?: Json | null
          weekly_roleplay_logs?: Json | null
          weeks_working?: number | null
          will_do_fp_goal?: number | null
        }
        Relationships: []
      }
      reps: {
        Row: {
          blitz_ready: boolean | null
          blitz_trip_date: string | null
          blitz_trip_end_date: string | null
          blitz_trip_location: string | null
          blitz_trip_name: string | null
          committed_blitzes: Json | null
          completed_tasks: Json | null
          contacted_for_blitz: Json | null
          counter_layout_config: Json | null
          created_at: string | null
          crm_detailed_enabled: boolean | null
          crm_enabled: boolean | null
          custom_counter_config: Json | null
          declined_blitz_rsvps: Json | null
          dismissed_recruit_ids: Json | null
          efp_mode_enabled: boolean | null
          email: string | null
          id: string
          intro_seen: boolean | null
          ipad_assigned: boolean | null
          last_nudge_time: string | null
          me_vs_me_enabled: boolean | null
          name: string
          notion_page_id: string | null
          nudge_leader: boolean | null
          onboarding_complete: boolean | null
          path_to_pro_progress: number | null
          path_to_pro_started: boolean | null
          personal_fp: number | null
          personal_fp_goal: number | null
          phone: string | null
          processed_blitz_ids: Json | null
          profile_photo_url: string | null
          ramp_phase_1_complete: boolean | null
          ramp_phase_2_complete: boolean | null
          ramp_phase_3_complete: boolean | null
          ramp_phase_4_complete: boolean | null
          ramp_to_blitz_phase: string | null
          recruiter: string | null
          reps_with_sale: number | null
          reps_with_sale_goal: number | null
          sales_logger_enabled: boolean | null
          slack_joined: boolean | null
          stage: string | null
          team_leader: string | null
          team_leader_phone: string | null
          timezone: string | null
          trainings_complete: boolean | null
          updated_at: string | null
          user_id: string | null
          watched_videos: Json | null
          year: string | null
        }
        Insert: {
          blitz_ready?: boolean | null
          blitz_trip_date?: string | null
          blitz_trip_end_date?: string | null
          blitz_trip_location?: string | null
          blitz_trip_name?: string | null
          committed_blitzes?: Json | null
          completed_tasks?: Json | null
          contacted_for_blitz?: Json | null
          counter_layout_config?: Json | null
          created_at?: string | null
          crm_detailed_enabled?: boolean | null
          crm_enabled?: boolean | null
          custom_counter_config?: Json | null
          declined_blitz_rsvps?: Json | null
          dismissed_recruit_ids?: Json | null
          efp_mode_enabled?: boolean | null
          email?: string | null
          id?: string
          intro_seen?: boolean | null
          ipad_assigned?: boolean | null
          last_nudge_time?: string | null
          me_vs_me_enabled?: boolean | null
          name: string
          notion_page_id?: string | null
          nudge_leader?: boolean | null
          onboarding_complete?: boolean | null
          path_to_pro_progress?: number | null
          path_to_pro_started?: boolean | null
          personal_fp?: number | null
          personal_fp_goal?: number | null
          phone?: string | null
          processed_blitz_ids?: Json | null
          profile_photo_url?: string | null
          ramp_phase_1_complete?: boolean | null
          ramp_phase_2_complete?: boolean | null
          ramp_phase_3_complete?: boolean | null
          ramp_phase_4_complete?: boolean | null
          ramp_to_blitz_phase?: string | null
          recruiter?: string | null
          reps_with_sale?: number | null
          reps_with_sale_goal?: number | null
          sales_logger_enabled?: boolean | null
          slack_joined?: boolean | null
          stage?: string | null
          team_leader?: string | null
          team_leader_phone?: string | null
          timezone?: string | null
          trainings_complete?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          watched_videos?: Json | null
          year?: string | null
        }
        Update: {
          blitz_ready?: boolean | null
          blitz_trip_date?: string | null
          blitz_trip_end_date?: string | null
          blitz_trip_location?: string | null
          blitz_trip_name?: string | null
          committed_blitzes?: Json | null
          completed_tasks?: Json | null
          contacted_for_blitz?: Json | null
          counter_layout_config?: Json | null
          created_at?: string | null
          crm_detailed_enabled?: boolean | null
          crm_enabled?: boolean | null
          custom_counter_config?: Json | null
          declined_blitz_rsvps?: Json | null
          dismissed_recruit_ids?: Json | null
          efp_mode_enabled?: boolean | null
          email?: string | null
          id?: string
          intro_seen?: boolean | null
          ipad_assigned?: boolean | null
          last_nudge_time?: string | null
          me_vs_me_enabled?: boolean | null
          name?: string
          notion_page_id?: string | null
          nudge_leader?: boolean | null
          onboarding_complete?: boolean | null
          path_to_pro_progress?: number | null
          path_to_pro_started?: boolean | null
          personal_fp?: number | null
          personal_fp_goal?: number | null
          phone?: string | null
          processed_blitz_ids?: Json | null
          profile_photo_url?: string | null
          ramp_phase_1_complete?: boolean | null
          ramp_phase_2_complete?: boolean | null
          ramp_phase_3_complete?: boolean | null
          ramp_phase_4_complete?: boolean | null
          ramp_to_blitz_phase?: string | null
          recruiter?: string | null
          reps_with_sale?: number | null
          reps_with_sale_goal?: number | null
          sales_logger_enabled?: boolean | null
          slack_joined?: boolean | null
          stage?: string | null
          team_leader?: string | null
          team_leader_phone?: string | null
          timezone?: string | null
          trainings_complete?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          watched_videos?: Json | null
          year?: string | null
        }
        Relationships: []
      }
      season_config: {
        Row: {
          created_at: string | null
          excluded_blitz_days: Json | null
          excluded_summer_days: string[] | null
          id: string
          knocking_mode_enabled: boolean | null
          personal_summer_end: string | null
          personal_summer_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          excluded_blitz_days?: Json | null
          excluded_summer_days?: string[] | null
          id?: string
          knocking_mode_enabled?: boolean | null
          personal_summer_end?: string | null
          personal_summer_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          excluded_blitz_days?: Json | null
          excluded_summer_days?: string[] | null
          id?: string
          knocking_mode_enabled?: boolean | null
          personal_summer_end?: string | null
          personal_summer_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      recruit_activity_type:
        | "phone_call"
        | "in_person"
        | "note"
        | "stage_change"
        | "next_step"
      recruit_stage:
        | "100_list"
        | "reached_out"
        | "evaluating"
        | "signed"
        | "shadow_complete"
        | "sold"
        | "sold_5_plus"
      suggestion_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      recruit_activity_type: [
        "phone_call",
        "in_person",
        "note",
        "stage_change",
        "next_step",
      ],
      recruit_stage: [
        "100_list",
        "reached_out",
        "evaluating",
        "signed",
        "shadow_complete",
        "sold",
        "sold_5_plus",
      ],
      suggestion_status: ["pending", "approved", "rejected"],
    },
  },
} as const
