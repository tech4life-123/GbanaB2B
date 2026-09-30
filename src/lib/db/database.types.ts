// GENERATED — do not edit by hand.
// Source: Supabase project vdncwiptaheshyomgmsd (supabase gen types typescript).
// Regenerate after every migration and commit alongside it.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          member_role: Database["public"]["Enums"]["business_member_role"]
          profile_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          member_role: Database["public"]["Enums"]["business_member_role"]
          profile_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          member_role?: Database["public"]["Enums"]["business_member_role"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_line: string | null
          business_type: Database["public"]["Enums"]["business_type"]
          contact_phone: string | null
          county: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          legal_name: string | null
          logo_path: string | null
          registration_number: string | null
          slug: string
          status: Database["public"]["Enums"]["business_status"]
          town: string
          trading_name: string
          updated_at: string
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["business_verification_status"]
          verified_at: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          address_line?: string | null
          business_type: Database["public"]["Enums"]["business_type"]
          contact_phone?: string | null
          county: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          registration_number?: string | null
          slug: string
          status?: Database["public"]["Enums"]["business_status"]
          town: string
          trading_name: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["business_verification_status"]
          verified_at?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          address_line?: string | null
          business_type?: Database["public"]["Enums"]["business_type"]
          contact_phone?: string | null
          county?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          registration_number?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["business_status"]
          town?: string
          trading_name?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["business_verification_status"]
          verified_at?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string
          is_sensitive: boolean
          key: string
          max_value: number | null
          min_value: number | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description: string
          is_sensitive?: boolean
          key: string
          max_value?: number | null
          min_value?: number | null
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string
          is_sensitive?: boolean
          key?: string
          max_value?: number | null
          min_value?: number | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          height: number | null
          id: string
          product_id: string
          sort_order: number
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          product_id: string
          sort_order?: number
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          product_id?: string
          sort_order?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          id: string
          max_qty: number | null
          min_qty: number
          product_id: string
          unit_price_minor: number
        }
        Insert: {
          id?: string
          max_qty?: number | null
          min_qty: number
          product_id: string
          unit_price_minor: number
        }
        Update: {
          id?: string
          max_qty?: number | null
          min_qty?: number
          product_id?: string
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          id: string
          label: string
          product_id: string
          sort_order: number
          value: string
        }
        Insert: {
          id?: string
          label: string
          product_id: string
          sort_order?: number
          value: string
        }
        Update: {
          id?: string
          label?: string
          product_id?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string
          category_id: string
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          description: string | null
          handling_notes: string | null
          height_mm: number | null
          id: string
          is_fragile: boolean
          is_stackable: boolean
          length_mm: number | null
          max_stack_layers: number | null
          moq: number
          origin_country: string | null
          packaging_type: Database["public"]["Enums"]["packaging_type"]
          published_at: string | null
          quantity_available: number
          search_vector: unknown
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          title: string
          unit_label: string
          unit_volume_cm3: number | null
          unit_weight_g: number | null
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          business_id: string
          category_id: string
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          handling_notes?: string | null
          height_mm?: number | null
          id?: string
          is_fragile?: boolean
          is_stackable?: boolean
          length_mm?: number | null
          max_stack_layers?: number | null
          moq?: number
          origin_country?: string | null
          packaging_type?: Database["public"]["Enums"]["packaging_type"]
          published_at?: string | null
          quantity_available?: number
          search_vector?: unknown
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          title: string
          unit_label: string
          unit_volume_cm3?: number | null
          unit_weight_g?: number | null
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          business_id?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          handling_notes?: string | null
          height_mm?: number | null
          id?: string
          is_fragile?: boolean
          is_stackable?: boolean
          length_mm?: number | null
          max_stack_layers?: number | null
          moq?: number
          origin_country?: string | null
          packaging_type?: Database["public"]["Enums"]["packaging_type"]
          published_at?: string | null
          quantity_available?: number
          search_vector?: unknown
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          title?: string
          unit_label?: string
          unit_volume_cm3?: number | null
          unit_weight_g?: number | null
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_role: Database["public"]["Enums"]["app_role"] | null
          display_name: string | null
          full_name: string | null
          id: string
          locale: string
          onboarded_at: string | null
          phone: string | null
          preferred_currency: Database["public"]["Enums"]["currency_code"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"] | null
          display_name?: string | null
          full_name?: string | null
          id: string
          locale?: string
          onboarded_at?: string | null
          phone?: string | null
          preferred_currency?: Database["public"]["Enums"]["currency_code"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"] | null
          display_name?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          onboarded_at?: string | null
          phone?: string | null
          preferred_currency?: Database["public"]["Enums"]["currency_code"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["role_status"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["role_status"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["role_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      product_listings: {
        Row: {
          business_county: string | null
          business_id: string | null
          business_name: string | null
          business_slug: string | null
          business_town: string | null
          business_verification:
            | Database["public"]["Enums"]["business_verification_status"]
            | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          cover_image_path: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          id: string | null
          min_price_minor: number | null
          moq: number | null
          moq_price_minor: number | null
          origin_country: string | null
          packaging_type: Database["public"]["Enums"]["packaging_type"] | null
          published_at: string | null
          quantity_available: number | null
          search_vector: unknown
          slug: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          tier_count: number | null
          title: string | null
          unit_label: string | null
          unit_weight_g: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_review_business: {
        Args: {
          p_business: string
          p_note?: string
          p_status: Database["public"]["Enums"]["business_status"]
          p_verification: Database["public"]["Enums"]["business_verification_status"]
        }
        Returns: undefined
      }
      bootstrap_admin: { Args: { p_phone: string }; Returns: string }
      can_edit_business: { Args: { p_business: string }; Returns: boolean }
      can_write_business_object: { Args: { p_name: string }; Returns: boolean }
      complete_onboarding: {
        Args: {
          p_full_name: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      create_business: {
        Args: {
          p_business_type: Database["public"]["Enums"]["business_type"]
          p_contact_phone?: string
          p_county: string
          p_description?: string
          p_town: string
          p_trading_name: string
        }
        Returns: string
      }
      grant_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_business_member: { Args: { p_business: string }; Returns: boolean }
      make_slug: { Args: { p_text: string }; Returns: string }
      request_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      revoke_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      save_product_pricing: {
        Args: {
          p_currency: Database["public"]["Enums"]["currency_code"]
          p_moq: number
          p_product: string
          p_tiers: Json
        }
        Returns: undefined
      }
      save_product_specifications: {
        Args: { p_product: string; p_specs: Json }
        Returns: undefined
      }
      set_default_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      update_platform_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      write_audit_log: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "closed"
      app_role: "buyer" | "seller" | "carrier" | "admin"
      business_member_role: "owner" | "manager" | "staff"
      business_status: "active" | "suspended" | "closed"
      business_type:
        | "importer"
        | "wholesaler"
        | "distributor"
        | "manufacturer"
        | "retailer"
        | "transport"
      business_verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
      currency_code: "USD" | "LRD"
      packaging_type:
        | "bag"
        | "sack"
        | "carton"
        | "box"
        | "crate"
        | "drum"
        | "jerrycan"
        | "bottle"
        | "tin"
        | "bale"
        | "bundle"
        | "roll"
        | "pallet"
        | "piece"
        | "other"
      product_status: "draft" | "active" | "paused" | "archived"
      role_status: "active" | "revoked"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "closed"],
      app_role: ["buyer", "seller", "carrier", "admin"],
      business_member_role: ["owner", "manager", "staff"],
      business_status: ["active", "suspended", "closed"],
      business_type: ["importer", "wholesaler", "distributor", "manufacturer", "retailer", "transport"],
      business_verification_status: ["unverified", "pending", "verified", "rejected"],
      currency_code: ["USD", "LRD"],
      packaging_type: [
        "bag", "sack", "carton", "box", "crate", "drum", "jerrycan", "bottle", "tin",
        "bale", "bundle", "roll", "pallet", "piece", "other",
      ],
      product_status: ["draft", "active", "paused", "archived"],
      role_status: ["active", "revoked"],
    },
  },
} as const
