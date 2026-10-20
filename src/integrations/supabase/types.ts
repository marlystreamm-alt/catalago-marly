export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_sessions: {
        Row: {
          actor_name: string;
          created_at: string;
          expires_at: string;
          id: string;
          last_used_at: string;
          revoked_at: string | null;
          token_hash: string;
          user_agent: string;
        };
        Insert: {
          actor_name?: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          last_used_at?: string;
          revoked_at?: string | null;
          token_hash: string;
          user_agent?: string;
        };
        Update: {
          actor_name?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          last_used_at?: string;
          revoked_at?: string | null;
          token_hash?: string;
          user_agent?: string;
        };
        Relationships: [];
      };
      app_backups: {
        Row: {
          business_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          note: string;
          payload: Json;
          scope: string;
        };
        Insert: {
          business_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          note?: string;
          payload: Json;
          scope: string;
        };
        Update: {
          business_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          note?: string;
          payload?: Json;
          scope?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_backups_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_app_state: {
        Row: {
          id: number;
          revision: number;
          state: Json;
          updated_at: string;
        };
        Insert: {
          id: number;
          revision?: number;
          state: Json;
          updated_at?: string;
        };
        Update: {
          id?: number;
          revision?: number;
          state?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      contract_renewals: {
        Row: {
          amount: number;
          business_id: string;
          created_at: string;
          id: string;
          new_expires_on: string;
          note: string;
          previous_expires_on: string | null;
        };
        Insert: {
          amount?: number;
          business_id: string;
          created_at?: string;
          id?: string;
          new_expires_on: string;
          note?: string;
          previous_expires_on?: string | null;
        };
        Update: {
          amount?: number;
          business_id?: string;
          created_at?: string;
          id?: string;
          new_expires_on?: string;
          note?: string;
          previous_expires_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contract_renewals_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      cyberdocs_integration_state: {
        Row: {
          additional_telegram_bots: Json;
          connection_required: boolean;
          cyberdocs_username: string;
          id: number;
          last_error: string;
          last_event_at: string | null;
          last_fallback_at: string | null;
          last_order_at: string | null;
          receiving_required: boolean;
          telegram_bot_username: string;
          updated_at: string;
        };
        Insert: {
          additional_telegram_bots?: Json;
          connection_required?: boolean;
          cyberdocs_username?: string;
          id?: number;
          last_error?: string;
          last_event_at?: string | null;
          last_fallback_at?: string | null;
          last_order_at?: string | null;
          receiving_required?: boolean;
          telegram_bot_username?: string;
          updated_at?: string;
        };
        Update: {
          additional_telegram_bots?: Json;
          connection_required?: boolean;
          cyberdocs_username?: string;
          id?: number;
          last_error?: string;
          last_event_at?: string | null;
          last_fallback_at?: string | null;
          last_order_at?: string | null;
          receiving_required?: boolean;
          telegram_bot_username?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cyberdocs_order_events: {
        Row: {
          action: string;
          actor: string;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          detail: string;
          id: string;
          order_id: string;
        };
        Insert: {
          action: string;
          actor?: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          detail?: string;
          id?: string;
          order_id: string;
        };
        Update: {
          action?: string;
          actor?: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          detail?: string;
          id?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cyberdocs_order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "cyberdocs_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      cyberdocs_orders: {
        Row: {
          assign_from_stock: boolean | null;
          assigned_at: string | null;
          assigned_by: string;
          business_connection_id: string;
          client_name: string;
          contact_label: string;
          contact_value: string;
          created_at: string;
          cyberdocs_order_id: string;
          delivered_on: string | null;
          expires_on: string | null;
          final_notes: string;
          finalized_at: string | null;
          finalized_by: string;
          id: string;
          notification_order_id: string | null;
          renewal_alerted_for: string | null;
          renewal_notification_order_id: string | null;
          renewal_status: string;
          renewal_warning_days: number;
          parsed_payload: Json;
          protected_delivery_id: string | null;
          protected_enabled: boolean;
          raw_message: string;
          sender_username: string;
          service_name: string;
          source: string;
          source_key: string;
          source_label: string;
          source_chat_id: string;
          source_event_key: string;
          source_message_id: string;
          status: string;
          stock_item_id: string | null;
          stock_snapshot_before: Json | null;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          assign_from_stock?: boolean | null;
          assigned_at?: string | null;
          assigned_by?: string;
          business_connection_id?: string;
          client_name?: string;
          contact_label?: string;
          contact_value?: string;
          created_at?: string;
          cyberdocs_order_id: string;
          delivered_on?: string | null;
          expires_on?: string | null;
          final_notes?: string;
          finalized_at?: string | null;
          finalized_by?: string;
          id?: string;
          notification_order_id?: string | null;
          renewal_alerted_for?: string | null;
          renewal_notification_order_id?: string | null;
          renewal_status?: string;
          renewal_warning_days?: number;
          parsed_payload?: Json;
          protected_delivery_id?: string | null;
          protected_enabled?: boolean;
          raw_message: string;
          sender_username?: string;
          service_name?: string;
          source?: string;
          source_key?: string;
          source_label?: string;
          source_chat_id?: string;
          source_event_key: string;
          source_message_id?: string;
          status?: string;
          stock_item_id?: string | null;
          stock_snapshot_before?: Json | null;
          updated_at?: string;
          whatsapp?: string;
        };
        Update: {
          assign_from_stock?: boolean | null;
          assigned_at?: string | null;
          assigned_by?: string;
          business_connection_id?: string;
          client_name?: string;
          contact_label?: string;
          contact_value?: string;
          created_at?: string;
          cyberdocs_order_id?: string;
          delivered_on?: string | null;
          expires_on?: string | null;
          final_notes?: string;
          finalized_at?: string | null;
          finalized_by?: string;
          id?: string;
          notification_order_id?: string | null;
          renewal_alerted_for?: string | null;
          renewal_notification_order_id?: string | null;
          renewal_status?: string;
          renewal_warning_days?: number;
          parsed_payload?: Json;
          protected_delivery_id?: string | null;
          protected_enabled?: boolean;
          raw_message?: string;
          sender_username?: string;
          service_name?: string;
          source?: string;
          source_key?: string;
          source_label?: string;
          source_chat_id?: string;
          source_event_key?: string;
          source_message_id?: string;
          status?: string;
          stock_item_id?: string | null;
          stock_snapshot_before?: Json | null;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cyberdocs_orders_notification_order_id_fkey";
            columns: ["notification_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cyberdocs_orders_renewal_notification_order_id_fkey";
            columns: ["renewal_notification_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cyberdocs_orders_protected_delivery_id_fkey";
            columns: ["protected_delivery_id"];
            isOneToOne: false;
            referencedRelation: "notification_log";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cyberdocs_orders_stock_item_id_fkey";
            columns: ["stock_item_id"];
            isOneToOne: false;
            referencedRelation: "stock_items";
            referencedColumns: ["id"];
          },
        ];
      };
      cyberdocs_webhook_events: {
        Row: {
          error_detail: string;
          event_key: string;
          id: string;
          order_id: string | null;
          payload: Json;
          processed_at: string | null;
          received_at: string;
          source: string;
          status: string;
          telegram_update_id: string;
        };
        Insert: {
          error_detail?: string;
          event_key: string;
          id?: string;
          order_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          source: string;
          status?: string;
          telegram_update_id?: string;
        };
        Update: {
          error_detail?: string;
          event_key?: string;
          id?: string;
          order_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          source?: string;
          status?: string;
          telegram_update_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cyberdocs_webhook_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "cyberdocs_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      directory_menu_requests: {
        Row: {
          access_username: string;
          admin_note: string;
          business_name: string;
          catalog_id: string;
          client_prepared_at: string | null;
          contact_name: string;
          created_at: string;
          directory_address: string;
          directory_approved_at: string | null;
          directory_category: string;
          directory_description: string;
          directory_image: string;
          directory_map_url: string;
          directory_schedule: string;
          directory_service_id: string | null;
          directory_status: string;
          email: string;
          id: string;
          lookup_code: string;
          menu_business_id: string | null;
          menu_requested_at: string | null;
          menu_status: string;
          menu_url: string;
          payment_amount: number;
          payment_confirmed_at: string | null;
          payment_instructions: string;
          payment_months: number;
          payment_proof: string;
          plan_space_type: string | null;
          service_id: string;
          service_name: string;
          status: string;
          trial_business_id: string | null;
          trial_ends_on: string | null;
          trial_space_type: string | null;
          trial_status: string;
          trial_url: string | null;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          access_username?: string;
          admin_note?: string;
          business_name?: string;
          catalog_id?: string;
          client_prepared_at?: string | null;
          contact_name?: string;
          created_at?: string;
          directory_address?: string;
          directory_approved_at?: string | null;
          directory_category?: string;
          directory_description?: string;
          directory_image?: string;
          directory_map_url?: string;
          directory_schedule?: string;
          directory_service_id?: string | null;
          directory_status?: string;
          email?: string;
          id?: string;
          lookup_code: string;
          menu_business_id?: string | null;
          menu_requested_at?: string | null;
          menu_status?: string;
          menu_url?: string;
          payment_amount?: number;
          payment_confirmed_at?: string | null;
          payment_instructions?: string;
          payment_months?: number;
          payment_proof?: string;
          plan_space_type?: string | null;
          service_id?: string;
          service_name?: string;
          status?: string;
          trial_business_id?: string | null;
          trial_ends_on?: string | null;
          trial_space_type?: string | null;
          trial_status?: string;
          trial_url?: string | null;
          updated_at?: string;
          whatsapp?: string;
        };
        Update: {
          access_username?: string;
          admin_note?: string;
          business_name?: string;
          catalog_id?: string;
          client_prepared_at?: string | null;
          contact_name?: string;
          created_at?: string;
          directory_address?: string;
          directory_approved_at?: string | null;
          directory_category?: string;
          directory_description?: string;
          directory_image?: string;
          directory_map_url?: string;
          directory_schedule?: string;
          directory_service_id?: string | null;
          directory_status?: string;
          email?: string;
          id?: string;
          lookup_code?: string;
          menu_business_id?: string | null;
          menu_requested_at?: string | null;
          menu_status?: string;
          menu_url?: string;
          payment_amount?: number;
          payment_confirmed_at?: string | null;
          payment_instructions?: string;
          payment_months?: number;
          payment_proof?: string;
          plan_space_type?: string | null;
          service_id?: string;
          service_name?: string;
          status?: string;
          trial_business_id?: string | null;
          trial_ends_on?: string | null;
          trial_space_type?: string | null;
          trial_status?: string;
          trial_url?: string | null;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "directory_menu_requests_menu_business_id_fkey";
            columns: ["menu_business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "directory_menu_requests_trial_business_id_fkey";
            columns: ["trial_business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_versions: {
        Row: {
          action: string;
          actor_name: string;
          business_id: string | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          payload: Json;
          revision: number;
        };
        Insert: {
          action: string;
          actor_name?: string;
          business_id?: string | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          payload: Json;
          revision: number;
        };
        Update: {
          action?: string;
          actor_name?: string;
          business_id?: string | null;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          payload?: Json;
          revision?: number;
        };
        Relationships: [
          {
            foreignKeyName: "entity_versions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_admins: {
        Row: {
          access_hash: string;
          access_salt: string;
          access_temp: boolean;
          business_id: string;
          created_at: string;
          id: string;
          last_login_at: string | null;
          name: string;
          suspended: boolean;
          updated_at: string;
        };
        Insert: {
          access_hash?: string;
          access_salt?: string;
          access_temp?: boolean;
          business_id: string;
          created_at?: string;
          id?: string;
          last_login_at?: string | null;
          name?: string;
          suspended?: boolean;
          updated_at?: string;
        };
        Update: {
          access_hash?: string;
          access_salt?: string;
          access_temp?: boolean;
          business_id?: string;
          created_at?: string;
          id?: string;
          last_login_at?: string | null;
          name?: string;
          suspended?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_admins_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_audit: {
        Row: {
          action: string;
          actor_kind: string;
          actor_name: string;
          after_value: string;
          before_value: string;
          business_id: string;
          created_at: string;
          field: string;
          id: string;
          target: string;
        };
        Insert: {
          action?: string;
          actor_kind?: string;
          actor_name?: string;
          after_value?: string;
          before_value?: string;
          business_id: string;
          created_at?: string;
          field?: string;
          id?: string;
          target?: string;
        };
        Update: {
          action?: string;
          actor_kind?: string;
          actor_name?: string;
          after_value?: string;
          before_value?: string;
          business_id?: string;
          created_at?: string;
          field?: string;
          id?: string;
          target?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_audit_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_backups: {
        Row: {
          actor_kind: string;
          actor_name: string;
          business_id: string;
          categories_count: number;
          created_at: string;
          id: string;
          items_count: number;
          label: string;
          origin: string;
          payload: Json;
          version: number;
        };
        Insert: {
          actor_kind?: string;
          actor_name?: string;
          business_id: string;
          categories_count?: number;
          created_at?: string;
          id?: string;
          items_count?: number;
          label?: string;
          origin?: string;
          payload?: Json;
          version?: number;
        };
        Update: {
          actor_kind?: string;
          actor_name?: string;
          business_id?: string;
          categories_count?: number;
          created_at?: string;
          id?: string;
          items_count?: number;
          label?: string;
          origin?: string;
          payload?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "menu_backups_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_businesses: {
        Row: {
          access_hash: string;
          access_salt: string;
          access_suspended: boolean;
          access_temp: boolean;
          access_updated_at: string | null;
          access_username: string;
          active: boolean;
          address: string;
          allowed_spaces: number;
          billing_day: number | null;
          contract_started_on: string;
          created_at: string;
          expires_on: string | null;
          features: Json;
          grace_days: number;
          id: string;
          logo_url: string;
          appearance: Json;
          multi_admin: boolean;
          name: string;
          notes: string;
          owner_name: string;
          plan_name: string;
          renewal_price: number;
          slug: string;
          sort_index: number;
          suspension_message: string;
          updated_at: string;
          whatsapp: string;
          whatsapp_template: string;
        };
        Insert: {
          access_hash?: string;
          access_salt?: string;
          access_suspended?: boolean;
          access_temp?: boolean;
          access_updated_at?: string | null;
          access_username?: string;
          active?: boolean;
          address?: string;
          allowed_spaces?: number;
          billing_day?: number | null;
          contract_started_on?: string;
          created_at?: string;
          expires_on?: string | null;
          features?: Json;
          grace_days?: number;
          id?: string;
          logo_url?: string;
          appearance?: Json;
          multi_admin?: boolean;
          name?: string;
          notes?: string;
          owner_name?: string;
          plan_name?: string;
          renewal_price?: number;
          slug?: string;
          sort_index?: number;
          suspension_message?: string;
          updated_at?: string;
          whatsapp?: string;
          whatsapp_template?: string;
        };
        Update: {
          access_hash?: string;
          access_salt?: string;
          access_suspended?: boolean;
          access_temp?: boolean;
          access_updated_at?: string | null;
          access_username?: string;
          active?: boolean;
          address?: string;
          allowed_spaces?: number;
          billing_day?: number | null;
          contract_started_on?: string;
          created_at?: string;
          expires_on?: string | null;
          features?: Json;
          grace_days?: number;
          id?: string;
          logo_url?: string;
          appearance?: Json;
          multi_admin?: boolean;
          name?: string;
          notes?: string;
          owner_name?: string;
          plan_name?: string;
          renewal_price?: number;
          slug?: string;
          sort_index?: number;
          suspension_message?: string;
          updated_at?: string;
          whatsapp?: string;
          whatsapp_template?: string;
        };
        Relationships: [];
      };
      menu_categories: {
        Row: {
          business_id: string;
          created_at: string;
          hidden: boolean;
          id: string;
          image_url: string;
          name: string;
          parent_id: string | null;
          revision: number;
          sort_index: number;
          space_id: string | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          image_url?: string;
          name?: string;
          parent_id?: string | null;
          revision?: number;
          sort_index?: number;
          space_id?: string | null;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          image_url?: string;
          name?: string;
          parent_id?: string | null;
          revision?: number;
          sort_index?: number;
          space_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_categories_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_categories_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "menu_spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          available: boolean;
          business_id: string;
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          image_url: string;
          item_condition: string;
          name: string;
          price: number;
          price_text: string;
          revision: number;
          sort_index: number;
          space_id: string | null;
          updated_at: string;
          whatsapp: string;
          whatsapp_message: string;
        };
        Insert: {
          available?: boolean;
          business_id: string;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string;
          item_condition?: string;
          name?: string;
          price?: number;
          price_text?: string;
          revision?: number;
          sort_index?: number;
          space_id?: string | null;
          updated_at?: string;
          whatsapp?: string;
          whatsapp_message?: string;
        };
        Update: {
          available?: boolean;
          business_id?: string;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string;
          item_condition?: string;
          name?: string;
          price?: number;
          price_text?: string;
          revision?: number;
          sort_index?: number;
          space_id?: string | null;
          updated_at?: string;
          whatsapp?: string;
          whatsapp_message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "menu_spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_spaces: {
        Row: {
          business_id: string;
          created_at: string;
          hidden: boolean;
          id: string;
          image_url: string;
          kind: string;
          name: string;
          notice_enabled: boolean;
          notice_message: string;
          notice_title: string;
          revision: number;
          slug: string;
          sort_index: number;
          subtitle: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          image_url?: string;
          kind?: string;
          name?: string;
          notice_enabled?: boolean;
          notice_message?: string;
          notice_title?: string;
          revision?: number;
          slug: string;
          sort_index?: number;
          subtitle?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          image_url?: string;
          kind?: string;
          name?: string;
          notice_enabled?: boolean;
          notice_message?: string;
          notice_title?: string;
          revision?: number;
          slug?: string;
          sort_index?: number;
          subtitle?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_spaces_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_subscriptions: {
        Row: {
          business_name: string;
          catalog_id: string;
          created_at: string;
          expires_on: string;
          id: string;
          notes: string;
          owner_name: string;
          plan: string;
          price: number;
          slug: string;
          started_on: string;
          suspended: boolean;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          business_name: string;
          catalog_id?: string;
          created_at?: string;
          expires_on?: string;
          id?: string;
          notes?: string;
          owner_name?: string;
          plan?: string;
          price?: number;
          slug: string;
          started_on?: string;
          suspended?: boolean;
          updated_at?: string;
          whatsapp?: string;
        };
        Update: {
          business_name?: string;
          catalog_id?: string;
          created_at?: string;
          expires_on?: string;
          id?: string;
          notes?: string;
          owner_name?: string;
          plan?: string;
          price?: number;
          slug?: string;
          started_on?: string;
          suspended?: boolean;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          attempt: number;
          channel: string;
          created_at: string;
          detail: string;
          id: string;
          kind: string;
          order_id: string | null;
          status: string;
        };
        Insert: {
          attempt?: number;
          channel?: string;
          created_at?: string;
          detail?: string;
          id?: string;
          kind?: string;
          order_id?: string | null;
          status?: string;
        };
        Update: {
          attempt?: number;
          channel?: string;
          created_at?: string;
          detail?: string;
          id?: string;
          kind?: string;
          order_id?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      notification_settings: {
        Row: {
          admin_code_hash: string;
          admin_code_salt: string;
          admin_must_change: boolean;
          admin_password_updated_at: string | null;
          admin_recovery_hash: string;
          admin_recovery_salt: string;
          alexa_app_device: string;
          alexa_body_template: string;
          alexa_device: string;
          alexa_events: Json;
          alexa_method: string;
          alexa_order_new_message: string | null;
          alexa_order_reminder_message: string | null;
          alexa_provider: string;
          alexa_token: string;
          alexa_webhook_secret: string;
          alexa_webhook_url: string;
          auto_off_midnight: boolean;
          channel_alexa: boolean;
          channel_alexa_app: boolean;
          channel_email: boolean;
          channel_push: boolean;
          channel_whatsapp: boolean;
          email: string;
          enabled: boolean;
          escalate_channel: string;
          escalate_enabled: boolean;
          escalate_minutes: number;
          id: number;
          quiet_end: string;
          quiet_start: string;
          repeat_enabled: boolean;
          repeat_minutes: number;
          timezone: string;
          updated_at: string;
          vapid_private_key: string | null;
          vapid_public_key: string | null;
          vapid_subject: string | null;
          whatsapp_number: string;
          whatsapp_provider: string;
        };
        Insert: {
          admin_code_hash?: string;
          admin_code_salt?: string;
          admin_must_change?: boolean;
          admin_password_updated_at?: string | null;
          admin_recovery_hash?: string;
          admin_recovery_salt?: string;
          alexa_app_device?: string;
          alexa_body_template?: string;
          alexa_device?: string;
          alexa_events?: Json;
          alexa_method?: string;
          alexa_order_new_message?: string | null;
          alexa_order_reminder_message?: string | null;
          alexa_provider?: string;
          alexa_token?: string;
          alexa_webhook_secret?: string;
          alexa_webhook_url?: string;
          auto_off_midnight?: boolean;
          channel_alexa?: boolean;
          channel_alexa_app?: boolean;
          channel_email?: boolean;
          channel_push?: boolean;
          channel_whatsapp?: boolean;
          email?: string;
          enabled?: boolean;
          escalate_channel?: string;
          escalate_enabled?: boolean;
          escalate_minutes?: number;
          id?: number;
          quiet_end?: string;
          quiet_start?: string;
          repeat_enabled?: boolean;
          repeat_minutes?: number;
          timezone?: string;
          updated_at?: string;
          vapid_private_key?: string | null;
          vapid_public_key?: string | null;
          vapid_subject?: string | null;
          whatsapp_number?: string;
          whatsapp_provider?: string;
        };
        Update: {
          admin_code_hash?: string;
          admin_code_salt?: string;
          admin_must_change?: boolean;
          admin_password_updated_at?: string | null;
          admin_recovery_hash?: string;
          admin_recovery_salt?: string;
          alexa_app_device?: string;
          alexa_body_template?: string;
          alexa_device?: string;
          alexa_events?: Json;
          alexa_method?: string;
          alexa_order_new_message?: string | null;
          alexa_order_reminder_message?: string | null;
          alexa_provider?: string;
          alexa_token?: string;
          alexa_webhook_secret?: string;
          alexa_webhook_url?: string;
          auto_off_midnight?: boolean;
          channel_alexa?: boolean;
          channel_alexa_app?: boolean;
          channel_email?: boolean;
          channel_push?: boolean;
          channel_whatsapp?: boolean;
          email?: string;
          enabled?: boolean;
          escalate_channel?: string;
          escalate_enabled?: boolean;
          escalate_minutes?: number;
          id?: number;
          quiet_end?: string;
          quiet_start?: string;
          repeat_enabled?: boolean;
          repeat_minutes?: number;
          timezone?: string;
          updated_at?: string;
          vapid_private_key?: string | null;
          vapid_public_key?: string | null;
          vapid_subject?: string | null;
          whatsapp_number?: string;
          whatsapp_provider?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          attended_at: string | null;
          catalog_id: string;
          catalog_name: string;
          created_at: string;
          escalated_at: string | null;
          id: string;
          items: Json;
          link: string;
          message: string;
          notified_at: string | null;
          notify_attempts: number;
          recipient: string;
          service_name: string;
          status: string;
          total: number;
        };
        Insert: {
          attended_at?: string | null;
          catalog_id?: string;
          catalog_name?: string;
          created_at?: string;
          escalated_at?: string | null;
          id?: string;
          items?: Json;
          link?: string;
          message?: string;
          notified_at?: string | null;
          notify_attempts?: number;
          recipient?: string;
          service_name?: string;
          status?: string;
          total?: number;
        };
        Update: {
          attended_at?: string | null;
          catalog_id?: string;
          catalog_name?: string;
          created_at?: string;
          escalated_at?: string | null;
          id?: string;
          items?: Json;
          link?: string;
          message?: string;
          notified_at?: string | null;
          notify_attempts?: number;
          recipient?: string;
          service_name?: string;
          status?: string;
          total?: number;
        };
        Relationships: [];
      };
      protected_deliveries: {
        Row: {
          client_name: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          last_viewed_at: string | null;
          max_views: number | null;
          notes: string;
          password_cipher: string;
          platform: string;
          status: string;
          token: string;
          updated_at: string;
          username: string;
          view_count: number;
          whatsapp: string;
        };
        Insert: {
          client_name?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_viewed_at?: string | null;
          max_views?: number | null;
          notes?: string;
          password_cipher?: string;
          platform?: string;
          status?: string;
          token: string;
          updated_at?: string;
          username?: string;
          view_count?: number;
          whatsapp?: string;
        };
        Update: {
          client_name?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_viewed_at?: string | null;
          max_views?: number | null;
          notes?: string;
          password_cipher?: string;
          platform?: string;
          status?: string;
          token?: string;
          updated_at?: string;
          username?: string;
          view_count?: number;
          whatsapp?: string;
        };
        Relationships: [];
      };
      protected_delivery_events: {
        Row: {
          created_at: string;
          delivery_id: string;
          detail: string;
          event_type: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          delivery_id: string;
          detail?: string;
          event_type: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          delivery_id?: string;
          detail?: string;
          event_type?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "protected_delivery_events_delivery_id_fkey";
            columns: ["delivery_id"];
            isOneToOne: false;
            referencedRelation: "protected_deliveries";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          active: boolean;
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          label: string;
          last_seen_at: string;
          p256dh: string;
        };
        Insert: {
          active?: boolean;
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          label?: string;
          last_seen_at?: string;
          p256dh: string;
        };
        Update: {
          active?: boolean;
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          label?: string;
          last_seen_at?: string;
          p256dh?: string;
        };
        Relationships: [];
      };
      stock_alert_settings: {
        Row: {
          business_key: string;
          expiry_warning_days: number;
          minimum_per_platform: number;
          renewal_warning_days: number;
          updated_at: string;
        };
        Insert: {
          business_key: string;
          expiry_warning_days?: number;
          minimum_per_platform?: number;
          renewal_warning_days?: number;
          updated_at?: string;
        };
        Update: {
          business_key?: string;
          expiry_warning_days?: number;
          minimum_per_platform?: number;
          renewal_warning_days?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_history: {
        Row: {
          action: string;
          business_id: string | null;
          created_at: string;
          detail: string;
          id: string;
          stock_id: string;
        };
        Insert: {
          action?: string;
          business_id?: string | null;
          created_at?: string;
          detail?: string;
          id?: string;
          stock_id: string;
        };
        Update: {
          action?: string;
          business_id?: string | null;
          created_at?: string;
          detail?: string;
          id?: string;
          stock_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_history_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_items: {
        Row: {
          account_type: string;
          acquired_on: string | null;
          business_id: string | null;
          catalog_ref: string;
          client_name: string;
          client_whatsapp: string;
          cost: number | null;
          created_at: string;
          delivered_on: string | null;
          expires_on: string | null;
          id: string;
          notes: string;
          panel_password_cipher: string;
          panel_url: string;
          panel_username: string;
          parent_stock_id: string | null;
          password_cipher: string;
          platform: string;
          profile_pin: string;
          protected_delivery_id: string | null;
          provider: string;
          related_order_id: string | null;
          renewal_notified_at: string | null;
          renewal_status: string;
          revision: number;
          sale_price: number | null;
          status: string;
          stock_kind: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          account_type?: string;
          acquired_on?: string | null;
          business_id?: string | null;
          catalog_ref?: string;
          client_name?: string;
          client_whatsapp?: string;
          cost?: number | null;
          created_at?: string;
          delivered_on?: string | null;
          expires_on?: string | null;
          id?: string;
          notes?: string;
          panel_password_cipher?: string;
          panel_url?: string;
          panel_username?: string;
          parent_stock_id?: string | null;
          password_cipher?: string;
          platform?: string;
          profile_pin?: string;
          protected_delivery_id?: string | null;
          provider?: string;
          related_order_id?: string | null;
          renewal_notified_at?: string | null;
          renewal_status?: string;
          revision?: number;
          sale_price?: number | null;
          status?: string;
          stock_kind?: string;
          updated_at?: string;
          username?: string;
        };
        Update: {
          account_type?: string;
          acquired_on?: string | null;
          business_id?: string | null;
          catalog_ref?: string;
          client_name?: string;
          client_whatsapp?: string;
          cost?: number | null;
          created_at?: string;
          delivered_on?: string | null;
          expires_on?: string | null;
          id?: string;
          notes?: string;
          panel_password_cipher?: string;
          panel_url?: string;
          panel_username?: string;
          parent_stock_id?: string | null;
          password_cipher?: string;
          platform?: string;
          profile_pin?: string;
          protected_delivery_id?: string | null;
          provider?: string;
          related_order_id?: string | null;
          renewal_notified_at?: string | null;
          renewal_status?: string;
          revision?: number;
          sale_price?: number | null;
          status?: string;
          stock_kind?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_items_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_items_parent_stock_id_fkey";
            columns: ["parent_stock_id"];
            isOneToOne: false;
            referencedRelation: "stock_items";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_renewals: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          new_expires: string | null;
          note: string;
          previous_expires: string | null;
          subscription_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: string;
          new_expires?: string | null;
          note?: string;
          previous_expires?: string | null;
          subscription_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          new_expires?: string | null;
          note?: string;
          previous_expires?: string | null;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_renewals_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "menu_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      system_activity: {
        Row: {
          action: string;
          actor_kind: string;
          actor_name: string;
          business_id: string | null;
          created_at: string;
          detail: string;
          entity_id: string;
          entity_type: string;
          id: string;
          section: string;
        };
        Insert: {
          action: string;
          actor_kind?: string;
          actor_name?: string;
          business_id?: string | null;
          created_at?: string;
          detail?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          section: string;
        };
        Update: {
          action?: string;
          actor_kind?: string;
          actor_name?: string;
          business_id?: string | null;
          created_at?: string;
          detail?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          section?: string;
        };
        Relationships: [
          {
            foreignKeyName: "system_activity_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "menu_businesses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      unaccent_fallback: { Args: { txt: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
