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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      menu_admins: {
        Row: {
          access_hash: string
          access_salt: string
          access_temp: boolean
          business_id: string
          created_at: string
          id: string
          last_login_at: string | null
          name: string
          suspended: boolean
          updated_at: string
        }
        Insert: {
          access_hash?: string
          access_salt?: string
          access_temp?: boolean
          business_id: string
          created_at?: string
          id?: string
          last_login_at?: string | null
          name?: string
          suspended?: boolean
          updated_at?: string
        }
        Update: {
          access_hash?: string
          access_salt?: string
          access_temp?: boolean
          business_id?: string
          created_at?: string
          id?: string
          last_login_at?: string | null
          name?: string
          suspended?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_admins_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "menu_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_audit: {
        Row: {
          action: string
          actor_kind: string
          actor_name: string
          after_value: string
          before_value: string
          business_id: string
          created_at: string
          field: string
          id: string
          target: string
        }
        Insert: {
          action?: string
          actor_kind?: string
          actor_name?: string
          after_value?: string
          before_value?: string
          business_id: string
          created_at?: string
          field?: string
          id?: string
          target?: string
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_name?: string
          after_value?: string
          before_value?: string
          business_id?: string
          created_at?: string
          field?: string
          id?: string
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_audit_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "menu_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_backups: {
        Row: {
          actor_kind: string
          actor_name: string
          business_id: string
          categories_count: number
          created_at: string
          id: string
          items_count: number
          label: string
          origin: string
          payload: Json
          version: number
        }
        Insert: {
          actor_kind?: string
          actor_name?: string
          business_id: string
          categories_count?: number
          created_at?: string
          id?: string
          items_count?: number
          label?: string
          origin?: string
          payload?: Json
          version?: number
        }
        Update: {
          actor_kind?: string
          actor_name?: string
          business_id?: string
          categories_count?: number
          created_at?: string
          id?: string
          items_count?: number
          label?: string
          origin?: string
          payload?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_backups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "menu_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_businesses: {
        Row: {
          access_hash: string
          access_salt: string
          access_suspended: boolean
          access_temp: boolean
          access_updated_at: string | null
          active: boolean
          address: string
          created_at: string
          expires_on: string | null
          features: Json
          id: string
          logo_url: string
          multi_admin: boolean
          name: string
          notes: string
          owner_name: string
          slug: string
          sort_index: number
          updated_at: string
          whatsapp: string
        }
        Insert: {
          access_hash?: string
          access_salt?: string
          access_suspended?: boolean
          access_temp?: boolean
          access_updated_at?: string | null
          active?: boolean
          address?: string
          created_at?: string
          expires_on?: string | null
          features?: Json
          id?: string
          logo_url?: string
          multi_admin?: boolean
          name?: string
          notes?: string
          owner_name?: string
          slug?: string
          sort_index?: number
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          access_hash?: string
          access_salt?: string
          access_suspended?: boolean
          access_temp?: boolean
          access_updated_at?: string | null
          active?: boolean
          address?: string
          created_at?: string
          expires_on?: string | null
          features?: Json
          id?: string
          logo_url?: string
          multi_admin?: boolean
          name?: string
          notes?: string
          owner_name?: string
          slug?: string
          sort_index?: number
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          sort_index: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name?: string
          sort_index?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "menu_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available: boolean
          business_id: string
          category_id: string | null
          created_at: string
          description: string
          id: string
          image_url: string
          name: string
          price: number
          price_text: string
          sort_index: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          business_id: string
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          name?: string
          price?: number
          price_text?: string
          sort_index?: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          business_id?: string
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          name?: string
          price?: number
          price_text?: string
          sort_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "menu_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_subscriptions: {
        Row: {
          business_name: string
          catalog_id: string
          created_at: string
          expires_on: string
          id: string
          notes: string
          owner_name: string
          plan: string
          price: number
          slug: string
          started_on: string
          suspended: boolean
          updated_at: string
          whatsapp: string
        }
        Insert: {
          business_name: string
          catalog_id?: string
          created_at?: string
          expires_on?: string
          id?: string
          notes?: string
          owner_name?: string
          plan?: string
          price?: number
          slug: string
          started_on?: string
          suspended?: boolean
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          business_name?: string
          catalog_id?: string
          created_at?: string
          expires_on?: string
          id?: string
          notes?: string
          owner_name?: string
          plan?: string
          price?: number
          slug?: string
          started_on?: string
          suspended?: boolean
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          attempt: number
          channel: string
          created_at: string
          detail: string
          id: string
          kind: string
          order_id: string | null
          status: string
        }
        Insert: {
          attempt?: number
          channel?: string
          created_at?: string
          detail?: string
          id?: string
          kind?: string
          order_id?: string | null
          status?: string
        }
        Update: {
          attempt?: number
          channel?: string
          created_at?: string
          detail?: string
          id?: string
          kind?: string
          order_id?: string | null
          status?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          admin_code_hash: string
          admin_code_salt: string
          alexa_device: string
          alexa_provider: string
          alexa_token: string
          auto_off_midnight: boolean
          channel_alexa: boolean
          channel_email: boolean
          channel_push: boolean
          channel_whatsapp: boolean
          email: string
          enabled: boolean
          escalate_channel: string
          escalate_enabled: boolean
          escalate_minutes: number
          id: number
          quiet_end: string
          quiet_start: string
          repeat_enabled: boolean
          repeat_minutes: number
          timezone: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          admin_code_hash?: string
          admin_code_salt?: string
          alexa_device?: string
          alexa_provider?: string
          alexa_token?: string
          auto_off_midnight?: boolean
          channel_alexa?: boolean
          channel_email?: boolean
          channel_push?: boolean
          channel_whatsapp?: boolean
          email?: string
          enabled?: boolean
          escalate_channel?: string
          escalate_enabled?: boolean
          escalate_minutes?: number
          id?: number
          quiet_end?: string
          quiet_start?: string
          repeat_enabled?: boolean
          repeat_minutes?: number
          timezone?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          admin_code_hash?: string
          admin_code_salt?: string
          alexa_device?: string
          alexa_provider?: string
          alexa_token?: string
          auto_off_midnight?: boolean
          channel_alexa?: boolean
          channel_email?: boolean
          channel_push?: boolean
          channel_whatsapp?: boolean
          email?: string
          enabled?: boolean
          escalate_channel?: string
          escalate_enabled?: boolean
          escalate_minutes?: number
          id?: number
          quiet_end?: string
          quiet_start?: string
          repeat_enabled?: boolean
          repeat_minutes?: number
          timezone?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          attended_at: string | null
          catalog_id: string
          catalog_name: string
          created_at: string
          escalated_at: string | null
          id: string
          items: Json
          link: string
          message: string
          notified_at: string | null
          notify_attempts: number
          recipient: string
          service_name: string
          status: string
          total: number
        }
        Insert: {
          attended_at?: string | null
          catalog_id?: string
          catalog_name?: string
          created_at?: string
          escalated_at?: string | null
          id?: string
          items?: Json
          link?: string
          message?: string
          notified_at?: string | null
          notify_attempts?: number
          recipient?: string
          service_name?: string
          status?: string
          total?: number
        }
        Update: {
          attended_at?: string | null
          catalog_id?: string
          catalog_name?: string
          created_at?: string
          escalated_at?: string | null
          id?: string
          items?: Json
          link?: string
          message?: string
          notified_at?: string | null
          notify_attempts?: number
          recipient?: string
          service_name?: string
          status?: string
          total?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          active: boolean
          auth: string
          created_at: string
          endpoint: string
          id: string
          label: string
          last_seen_at: string
          p256dh: string
        }
        Insert: {
          active?: boolean
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          label?: string
          last_seen_at?: string
          p256dh: string
        }
        Update: {
          active?: boolean
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          label?: string
          last_seen_at?: string
          p256dh?: string
        }
        Relationships: []
      }
      subscription_renewals: {
        Row: {
          created_at: string
          id: string
          kind: string
          new_expires: string | null
          note: string
          previous_expires: string | null
          subscription_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          new_expires?: string | null
          note?: string
          previous_expires?: string | null
          subscription_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          new_expires?: string | null
          note?: string
          previous_expires?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_renewals_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "menu_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      unaccent_fallback: { Args: { txt: string }; Returns: string }
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
