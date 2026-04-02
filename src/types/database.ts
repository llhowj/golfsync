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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      deadline_alerts: {
        Row: {
          id: string
          sent_at: string
          tee_time_id: string
        }
        Insert: {
          id?: string
          sent_at?: string
          tee_time_id: string
        }
        Update: {
          id?: string
          sent_at?: string
          tee_time_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_alerts_tee_time_id_fkey"
            columns: ["tee_time_id"]
            isOneToOne: true
            referencedRelation: "tee_times"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invited_email: string | null
          invited_name: string | null
          is_admin: boolean
          notification_channels: Database["public"]["Enums"]["notification_channel"][]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          is_admin?: boolean
          notification_channels?: Database["public"]["Enums"]["notification_channel"][]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          is_admin?: boolean
          notification_channels?: Database["public"]["Enums"]["notification_channel"][]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          cancellation_deadline_hours: number
          created_at: string
          deadline_alerts_enabled: boolean
          home_course: string | null
          id: string
          name: string
        }
        Insert: {
          cancellation_deadline_hours?: number
          created_at?: string
          deadline_alerts_enabled?: boolean
          home_course?: string | null
          id?: string
          name: string
        }
        Update: {
          cancellation_deadline_hours?: number
          created_at?: string
          deadline_alerts_enabled?: boolean
          home_course?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          id: string
          invited_at: string
          member_id: string
          sequence_num: number | null
          tee_time_id: string
        }
        Insert: {
          id?: string
          invited_at?: string
          member_id: string
          sequence_num?: number | null
          tee_time_id: string
        }
        Update: {
          id?: string
          invited_at?: string
          member_id?: string
          sequence_num?: number | null
          tee_time_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_tee_time_id_fkey"
            columns: ["tee_time_id"]
            isOneToOne: false
            referencedRelation: "tee_times"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          member_id: string
          payload: Json | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          tee_time_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          member_id: string
          payload?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          tee_time_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          member_id?: string
          payload?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          tee_time_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tee_time_id_fkey"
            columns: ["tee_time_id"]
            isOneToOne: false
            referencedRelation: "tee_times"
            referencedColumns: ["id"]
          },
        ]
      }
      play_history: {
        Row: {
          attended: boolean
          id: string
          member_id: string
          recorded_at: string
          tee_time_id: string
        }
        Insert: {
          attended?: boolean
          id?: string
          member_id: string
          recorded_at?: string
          tee_time_id: string
        }
        Update: {
          attended?: boolean
          id?: string
          member_id?: string
          recorded_at?: string
          tee_time_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_history_tee_time_id_fkey"
            columns: ["tee_time_id"]
            isOneToOne: false
            referencedRelation: "tee_times"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          id: string
          member_id: string
          poll_id: string
          preference: Database["public"]["Enums"]["poll_preference"]
          responded_at: string
        }
        Insert: {
          id?: string
          member_id: string
          poll_id: string
          preference: Database["public"]["Enums"]["poll_preference"]
          responded_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          poll_id?: string
          preference?: Database["public"]["Enums"]["poll_preference"]
          responded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string
          id: string
          proposed_date: string
          proposed_time: string
          tee_time_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          proposed_date: string
          proposed_time: string
          tee_time_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          proposed_date?: string
          proposed_time?: string
          tee_time_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_tee_time_id_fkey"
            columns: ["tee_time_id"]
            isOneToOne: false
            referencedRelation: "tee_times"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          id: string
          member_id: string
          note: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          tee_time_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          note?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          tee_time_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          tee_time_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_tee_time_id_fkey"
            columns: ["tee_time_id"]
            isOneToOne: false
            referencedRelation: "tee_times"
            referencedColumns: ["id"]
          },
        ]
      }
      tee_times: {
        Row: {
          course: string
          created_at: string
          created_by: string
          date: string
          deleted_at: string | null
          group_id: string
          id: string
          max_slots: number
          notes: string | null
          start_time: string
          time_changed_at: string | null
        }
        Insert: {
          course: string
          created_at?: string
          created_by: string
          date: string
          deleted_at?: string | null
          group_id: string
          id?: string
          max_slots?: number
          notes?: string | null
          start_time: string
          time_changed_at?: string | null
        }
        Update: {
          course?: string
          created_at?: string
          created_by?: string
          date?: string
          deleted_at?: string | null
          group_id?: string
          id?: string
          max_slots?: number
          notes?: string | null
          start_time?: string
          time_changed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tee_times_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tee_times_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      notification_channel: "email" | "sms" | "push"
      notification_status: "pending" | "sent" | "failed"
      notification_type:
        | "tee_time_posted"
        | "tee_time_changed"
        | "tee_time_deleted"
        | "slot_filled"
        | "rsvp_reminder"
        | "deadline_alert"
        | "rsvp_change"
        | "time_change_poll"
      poll_preference: "new" | "keep" | "no_preference"
      rsvp_status: "in" | "out" | "pending"
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
      notification_channel: ["email", "sms", "push"],
      notification_status: ["pending", "sent", "failed"],
      notification_type: [
        "tee_time_posted",
        "tee_time_changed",
        "tee_time_deleted",
        "slot_filled",
        "rsvp_reminder",
        "deadline_alert",
        "rsvp_change",
        "time_change_poll",
      ],
      poll_preference: ["new", "keep", "no_preference"],
      rsvp_status: ["in", "out", "pending"],
    },
  },
} as const
