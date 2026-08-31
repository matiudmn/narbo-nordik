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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      club_settings: {
        Row: {
          allure_zones: Json
          featured_at: string | null
          featured_validation_id: string | null
          id: string
          invite_code: string
          race_paces: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allure_zones?: Json
          featured_at?: string | null
          featured_validation_id?: string | null
          id?: string
          invite_code?: string
          race_paces?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allure_zones?: Json
          featured_at?: string | null
          featured_validation_id?: string | null
          id?: string
          invite_code?: string
          race_paces?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_settings_featured_validation_id_fkey"
            columns: ["featured_validation_id"]
            isOneToOne: false
            referencedRelation: "session_validations"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_feedbacks: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          reason: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          reason: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          reason?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          address_city: string | null
          address_postal_code: string | null
          address_street: string | null
          birth_date: string
          created_at: string
          email: string
          family_group: string | null
          firstname: string
          id: string
          lastname: string
          nationality: string | null
          notes: string | null
          phone: string | null
          section: string
          sex: string
          source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_city?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          birth_date: string
          created_at?: string
          email: string
          family_group?: string | null
          firstname: string
          id?: string
          lastname: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          section: string
          sex: string
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_city?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          birth_date?: string
          created_at?: string
          email?: string
          family_group?: string | null
          firstname?: string
          id?: string
          lastname?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          section?: string
          sex?: string
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      membership_seasons: {
        Row: {
          activities: string[]
          amount_due_cents: number
          amount_paid_cents: number
          ce_certificate_requested: boolean
          created_at: string
          family_discount_cents: number
          gdpr_consent_at: string
          id: string
          license_type: string | null
          member_id: string
          membership_type: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          rules_accepted_at: string
          season: string
          section: string
          status: string
          stripe_payment_intent_id: string | null
          tshirt_included: boolean
          tshirt_model: string | null
          tshirt_size: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          activities?: string[]
          amount_due_cents: number
          amount_paid_cents?: number
          ce_certificate_requested?: boolean
          created_at?: string
          family_discount_cents?: number
          gdpr_consent_at: string
          id?: string
          license_type?: string | null
          member_id: string
          membership_type: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          rules_accepted_at: string
          season: string
          section: string
          status?: string
          stripe_payment_intent_id?: string | null
          tshirt_included?: boolean
          tshirt_model?: string | null
          tshirt_size?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          activities?: string[]
          amount_due_cents?: number
          amount_paid_cents?: number
          ce_certificate_requested?: boolean
          created_at?: string
          family_discount_cents?: number
          gdpr_consent_at?: string
          id?: string
          license_type?: string | null
          member_id?: string
          membership_type?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          rules_accepted_at?: string
          season?: string
          section?: string
          status?: string
          stripe_payment_intent_id?: string | null
          tshirt_included?: boolean
          tshirt_model?: string | null
          tshirt_size?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_seasons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          link: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      race_nordiks: {
        Row: {
          created_at: string | null
          id: string
          race_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          race_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          race_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_nordiks_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "race_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_nordiks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      race_results: {
        Row: {
          comment: string | null
          created_at: string | null
          date: string
          distance_km: number
          id: string
          is_label: boolean | null
          race_name: string
          race_type: string
          time_duration: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          date: string
          distance_km: number
          id?: string
          is_label?: boolean | null
          race_name: string
          race_type: string
          time_duration: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          date?: string
          distance_km?: number
          id?: string
          is_label?: boolean | null
          race_name?: string
          race_type?: string
          time_duration?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_analyses: {
        Row: {
          created_at: string
          id: string
          input_hash: string
          model: string
          validation_id: string
          verdict: Json
        }
        Insert: {
          created_at?: string
          id?: string
          input_hash: string
          model: string
          validation_id: string
          verdict: Json
        }
        Update: {
          created_at?: string
          id?: string
          input_hash?: string
          model?: string
          validation_id?: string
          verdict?: Json
        }
        Relationships: [
          {
            foreignKeyName: "session_analyses_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: true
            referencedRelation: "session_validations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_nordiks: {
        Row: {
          created_at: string | null
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_nordiks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_nordiks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_templates: {
        Row: {
          blocks: Json
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_seed: boolean | null
          name: string
          session_type: string
          terrain_options: Json | null
          usage_count: number | null
        }
        Insert: {
          blocks?: Json
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_seed?: boolean | null
          name: string
          session_type: string
          terrain_options?: Json | null
          usage_count?: number | null
        }
        Update: {
          blocks?: Json
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_seed?: boolean | null
          name?: string
          session_type?: string
          terrain_options?: Json | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_validations: {
        Row: {
          attachment_path: string | null
          attachment_type: string | null
          avg_cadence: number | null
          avg_hr: number | null
          created_at: string | null
          distance_m: number | null
          duration_s: number | null
          elevation_m: number | null
          feedback: string | null
          id: string
          max_hr: number | null
          metrics_source: string | null
          objective_reached: string | null
          rpe: number | null
          sensations: string | null
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          attachment_type?: string | null
          avg_cadence?: number | null
          avg_hr?: number | null
          created_at?: string | null
          distance_m?: number | null
          duration_s?: number | null
          elevation_m?: number | null
          feedback?: string | null
          id?: string
          max_hr?: number | null
          metrics_source?: string | null
          objective_reached?: string | null
          rpe?: number | null
          sensations?: string | null
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          attachment_type?: string | null
          avg_cadence?: number | null
          avg_hr?: number | null
          created_at?: string | null
          distance_m?: number | null
          duration_s?: number | null
          elevation_m?: number | null
          feedback?: string | null
          id?: string
          max_hr?: number | null
          metrics_source?: string | null
          objective_reached?: string | null
          rpe?: number | null
          sensations?: string | null
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_validations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_validations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          blocks: Json | null
          created_at: string | null
          created_by: string
          date: string
          description: string | null
          group_id: string | null
          id: string
          is_personal: boolean | null
          location: string | null
          location_url: string | null
          preparation_id: string | null
          session_rpe: number | null
          session_type: string
          target_distance: number | null
          terrain_options: Json | null
          title: string
          vma_percent_max: number | null
          vma_percent_min: number | null
        }
        Insert: {
          blocks?: Json | null
          created_at?: string | null
          created_by: string
          date: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_personal?: boolean | null
          location?: string | null
          location_url?: string | null
          preparation_id?: string | null
          session_rpe?: number | null
          session_type?: string
          target_distance?: number | null
          terrain_options?: Json | null
          title: string
          vma_percent_max?: number | null
          vma_percent_min?: number | null
        }
        Update: {
          blocks?: Json | null
          created_at?: string | null
          created_by?: string
          date?: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_personal?: boolean | null
          location?: string | null
          location_url?: string | null
          preparation_id?: string | null
          session_rpe?: number | null
          session_type?: string
          target_distance?: number | null
          terrain_options?: Json | null
          title?: string
          vma_percent_max?: number | null
          vma_percent_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_preparation_id_fkey"
            columns: ["preparation_id"]
            isOneToOne: false
            referencedRelation: "specific_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      specific_preparations: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "specific_preparations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preparations: {
        Row: {
          id: string
          preparation_id: string
          user_id: string
        }
        Insert: {
          id?: string
          preparation_id: string
          user_id: string
        }
        Update: {
          id?: string
          preparation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preparations_preparation_id_fkey"
            columns: ["preparation_id"]
            isOneToOne: false
            referencedRelation: "specific_preparations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preparations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          birth_date: string | null
          created_at: string | null
          email: string
          firstname: string
          group_id: string | null
          id: string
          is_board: boolean
          is_public: boolean | null
          is_super_admin: boolean
          lastname: string
          license_number: string | null
          notification_preferences: Json | null
          phone: string | null
          photo_url: string | null
          role: string
          vma: number | null
          vma_history: Json | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          email: string
          firstname: string
          group_id?: string | null
          id: string
          is_board?: boolean
          is_public?: boolean | null
          is_super_admin?: boolean
          lastname: string
          license_number?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          photo_url?: string | null
          role?: string
          vma?: number | null
          vma_history?: Json | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          email?: string
          firstname?: string
          group_id?: string | null
          id?: string
          is_board?: boolean
          is_public?: boolean | null
          is_super_admin?: boolean
          lastname?: string
          license_number?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          photo_url?: string | null
          role?: string
          vma?: number | null
          vma_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "users_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_reactions: {
        Row: {
          author_id: string
          created_at: string | null
          emoji: string
          id: string
          validation_id: string
        }
        Insert: {
          author_id: string
          created_at?: string | null
          emoji: string
          id?: string
          validation_id: string
        }
        Update: {
          author_id?: string
          created_at?: string | null
          emoji?: string
          id?: string
          validation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_reactions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_reactions_validation_id_fkey"
            columns: ["validation_id"]
            isOneToOne: false
            referencedRelation: "session_validations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_app_secret: {
        Args: { p_name: string; p_required?: boolean }
        Returns: string
      }
      get_own_profile: {
        Args: never
        Returns: {
          birth_date: string | null
          created_at: string | null
          email: string
          firstname: string
          group_id: string | null
          id: string
          is_board: boolean
          is_public: boolean | null
          is_super_admin: boolean
          lastname: string
          license_number: string | null
          notification_preferences: Json | null
          phone: string | null
          photo_url: string | null
          role: string
          vma: number | null
          vma_history: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_users_for_coach: {
        Args: never
        Returns: {
          birth_date: string | null
          created_at: string | null
          email: string
          firstname: string
          group_id: string | null
          id: string
          is_board: boolean
          is_public: boolean | null
          is_super_admin: boolean
          lastname: string
          license_number: string | null
          notification_preferences: Json | null
          phone: string | null
          photo_url: string | null
          role: string
          vma: number | null
          vma_history: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      import_sessions_bulk: {
        Args: { p_rows: Json }
        Returns: {
          blocks: Json | null
          created_at: string | null
          created_by: string
          date: string
          description: string | null
          group_id: string | null
          id: string
          is_personal: boolean | null
          location: string | null
          location_url: string | null
          preparation_id: string | null
          session_rpe: number | null
          session_type: string
          target_distance: number | null
          terrain_options: Json | null
          title: string
          vma_percent_max: number | null
          vma_percent_min: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      link_member_to_user: { Args: never; Returns: string }
      notify_coaches_missing_vma: { Args: never; Returns: undefined }
      register_profile: {
        Args: {
          email: string
          firstname: string
          invite_code: string
          lastname: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
