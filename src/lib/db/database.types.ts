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
      addresses: {
        Row: {
          contact_name: string
          contact_phone: string
          county: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          latitude: number | null
          longitude: number | null
          profile_id: string
          street: string | null
          town: string
          updated_at: string
        }
        Insert: {
          contact_name: string
          contact_phone: string
          county: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          profile_id: string
          street?: string | null
          town: string
          updated_at?: string
        }
        Update: {
          contact_name?: string
          contact_phone?: string
          county?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          profile_id?: string
          street?: string | null
          town?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      carrier_assignments: {
        Row: {
          amount_minor: number
          assigned_at: string
          assigned_by: string | null
          bid_id: string
          cancelled_at: string | null
          carrier_id: string
          carrier_snapshot: Json
          currency: Database["public"]["Enums"]["currency_code"]
          dropoff_snapshot: Json
          eta_hours: number
          id: string
          order_id: string
          pickup_snapshot: Json
          proposed_delivery_date: string
          rfq_id: string
          status: string
          vehicle_id: string
        }
        Insert: {
          amount_minor: number
          assigned_at?: string
          assigned_by?: string | null
          bid_id: string
          cancelled_at?: string | null
          carrier_id: string
          carrier_snapshot: Json
          currency: Database["public"]["Enums"]["currency_code"]
          dropoff_snapshot: Json
          eta_hours: number
          id?: string
          order_id: string
          pickup_snapshot: Json
          proposed_delivery_date: string
          rfq_id: string
          status?: string
          vehicle_id: string
        }
        Update: {
          amount_minor?: number
          assigned_at?: string
          assigned_by?: string | null
          bid_id?: string
          cancelled_at?: string | null
          carrier_id?: string
          carrier_snapshot?: Json
          currency?: Database["public"]["Enums"]["currency_code"]
          dropoff_snapshot?: Json
          eta_hours?: number
          id?: string
          order_id?: string
          pickup_snapshot?: Json
          proposed_delivery_date?: string
          rfq_id?: string
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_assignments_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "freight_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_assignments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_assignments_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "freight_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_documents: {
        Row: {
          carrier_id: string
          doc_type: Database["public"]["Enums"]["carrier_document_type"]
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          vehicle_id: string | null
        }
        Insert: {
          carrier_id: string
          doc_type: Database["public"]["Enums"]["carrier_document_type"]
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
          vehicle_id?: string | null
        }
        Update: {
          carrier_id?: string
          doc_type?: Database["public"]["Enums"]["carrier_document_type"]
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrier_documents_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_profiles: {
        Row: {
          address: string
          coverage_counties: string[]
          created_at: string
          full_name: string
          home_county: string
          home_town: string
          id: string
          is_available: boolean
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string | null
          updated_at: string
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["carrier_verification_status"]
          verified_at: string | null
        }
        Insert: {
          address: string
          coverage_counties: string[]
          created_at?: string
          full_name: string
          home_county: string
          home_town: string
          id: string
          is_available?: boolean
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["carrier_verification_status"]
          verified_at?: string | null
        }
        Update: {
          address?: string
          coverage_counties?: string[]
          created_at?: string
          full_name?: string
          home_county?: string
          home_town?: string
          id?: string
          is_available?: boolean
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["carrier_verification_status"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrier_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          profile_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          profile_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          profile_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_accounts: {
        Row: {
          amount_minor: number
          carrier_net_minor: number
          currency: Database["public"]["Enums"]["currency_code"]
          fee_minor: number
          funded_at: string
          id: string
          intent_id: string
          order_id: string
          refunded_at: string | null
          released_at: string | null
          seller_net_minor: number
          status: Database["public"]["Enums"]["escrow_status"]
        }
        Insert: {
          amount_minor: number
          carrier_net_minor: number
          currency: Database["public"]["Enums"]["currency_code"]
          fee_minor: number
          funded_at?: string
          id?: string
          intent_id: string
          order_id: string
          refunded_at?: string | null
          released_at?: string | null
          seller_net_minor: number
          status?: Database["public"]["Enums"]["escrow_status"]
        }
        Update: {
          amount_minor?: number
          carrier_net_minor?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          fee_minor?: number
          funded_at?: string
          id?: string
          intent_id?: string
          order_id?: string
          refunded_at?: string | null
          released_at?: string | null
          seller_net_minor?: number
          status?: Database["public"]["Enums"]["escrow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "escrow_accounts_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_accounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base: Database["public"]["Enums"]["currency_code"]
          effective_at: string
          id: number
          note: string | null
          quote: Database["public"]["Enums"]["currency_code"]
          rate: number
          set_by: string | null
        }
        Insert: {
          base: Database["public"]["Enums"]["currency_code"]
          effective_at?: string
          id?: never
          note?: string | null
          quote: Database["public"]["Enums"]["currency_code"]
          rate: number
          set_by?: string | null
        }
        Update: {
          base?: Database["public"]["Enums"]["currency_code"]
          effective_at?: string
          id?: never
          note?: string | null
          quote?: Database["public"]["Enums"]["currency_code"]
          rate?: number
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_bids: {
        Row: {
          amount_minor: number
          carrier_id: string
          carrier_name: string
          currency: Database["public"]["Enums"]["currency_code"]
          decided_at: string | null
          eta_hours: number
          id: string
          note: string | null
          payload_kg: number
          proposed_delivery_date: string
          rfq_id: string
          status: Database["public"]["Enums"]["freight_bid_status"]
          submitted_at: string
          updated_at: string
          vehicle_class: Database["public"]["Enums"]["vehicle_class"]
          vehicle_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          amount_minor: number
          carrier_id: string
          carrier_name: string
          currency: Database["public"]["Enums"]["currency_code"]
          decided_at?: string | null
          eta_hours: number
          id?: string
          note?: string | null
          payload_kg: number
          proposed_delivery_date: string
          rfq_id: string
          status?: Database["public"]["Enums"]["freight_bid_status"]
          submitted_at?: string
          updated_at?: string
          vehicle_class: Database["public"]["Enums"]["vehicle_class"]
          vehicle_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          amount_minor?: number
          carrier_id?: string
          carrier_name?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          decided_at?: string | null
          eta_hours?: number
          id?: string
          note?: string | null
          payload_kg?: number
          proposed_delivery_date?: string
          rfq_id?: string
          status?: Database["public"]["Enums"]["freight_bid_status"]
          submitted_at?: string
          updated_at?: string
          vehicle_class?: Database["public"]["Enums"]["vehicle_class"]
          vehicle_id?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "freight_bids_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_bids_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "freight_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_bids_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_rfqs: {
        Row: {
          awarded_bid_id: string | null
          cancelled_reason: string | null
          cargo_summary: string
          cargo_volume_cm3: number | null
          cargo_weight_g: number
          closes_at: string
          created_at: string
          created_by: string | null
          created_by_role: string
          currency: Database["public"]["Enums"]["currency_code"]
          destination_county: string
          destination_landmark: string | null
          destination_town: string
          handling_notes: string | null
          id: string
          is_fragile: boolean
          is_stackable: boolean
          order_id: string
          package_count: number
          pickup_area: string | null
          pickup_county: string
          pickup_date: string
          pickup_town: string
          preferred_delivery_date: string | null
          required_class: Database["public"]["Enums"]["vehicle_class"]
          rfq_number: string
          special_instructions: string | null
          status: Database["public"]["Enums"]["freight_rfq_status"]
          updated_at: string
        }
        Insert: {
          awarded_bid_id?: string | null
          cancelled_reason?: string | null
          cargo_summary: string
          cargo_volume_cm3?: number | null
          cargo_weight_g: number
          closes_at: string
          created_at?: string
          created_by?: string | null
          created_by_role: string
          currency: Database["public"]["Enums"]["currency_code"]
          destination_county: string
          destination_landmark?: string | null
          destination_town: string
          handling_notes?: string | null
          id?: string
          is_fragile?: boolean
          is_stackable?: boolean
          order_id: string
          package_count: number
          pickup_area?: string | null
          pickup_county: string
          pickup_date: string
          pickup_town: string
          preferred_delivery_date?: string | null
          required_class: Database["public"]["Enums"]["vehicle_class"]
          rfq_number: string
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["freight_rfq_status"]
          updated_at?: string
        }
        Update: {
          awarded_bid_id?: string | null
          cancelled_reason?: string | null
          cargo_summary?: string
          cargo_volume_cm3?: number | null
          cargo_weight_g?: number
          closes_at?: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          destination_county?: string
          destination_landmark?: string | null
          destination_town?: string
          handling_notes?: string | null
          id?: string
          is_fragile?: boolean
          is_stackable?: boolean
          order_id?: string
          package_count?: number
          pickup_area?: string | null
          pickup_county?: string
          pickup_date?: string
          pickup_town?: string
          preferred_delivery_date?: string | null
          required_class?: Database["public"]["Enums"]["vehicle_class"]
          rfq_number?: string
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["freight_rfq_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_rfqs_awarded_bid_fkey"
            columns: ["awarded_bid_id"]
            isOneToOne: false
            referencedRelation: "freight_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_rfqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_rfqs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account: string
          amount_minor: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          direction: string
          entry_group: string
          id: number
          kind: string
          memo: string | null
          order_id: string | null
          payment_txn_id: string | null
          payout_id: string | null
          refund_id: string | null
        }
        Insert: {
          account: string
          amount_minor: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          direction: string
          entry_group: string
          id?: never
          kind: string
          memo?: string | null
          order_id?: string | null
          payment_txn_id?: string | null
          payout_id?: string | null
          refund_id?: string | null
        }
        Update: {
          account?: string
          amount_minor?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          direction?: string
          entry_group?: string
          id?: never
          kind?: string
          memo?: string | null
          order_id?: string | null
          payment_txn_id?: string | null
          payout_id?: string | null
          refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total_minor: number
          order_id: string
          packaging_type: Database["public"]["Enums"]["packaging_type"]
          product_id: string | null
          quantity: number
          sku: string | null
          tier_max_qty: number | null
          tier_min_qty: number
          title: string
          unit_label: string
          unit_price_minor: number
          unit_weight_g: number
        }
        Insert: {
          id?: string
          line_total_minor: number
          order_id: string
          packaging_type: Database["public"]["Enums"]["packaging_type"]
          product_id?: string | null
          quantity: number
          sku?: string | null
          tier_max_qty?: number | null
          tier_min_qty: number
          title: string
          unit_label: string
          unit_price_minor: number
          unit_weight_g: number
        }
        Update: {
          id?: string
          line_total_minor?: number
          order_id?: string
          packaging_type?: Database["public"]["Enums"]["packaging_type"]
          product_id?: string | null
          quantity?: number
          sku?: string | null
          tier_max_qty?: number | null
          tier_min_qty?: number
          title?: string
          unit_label?: string
          unit_price_minor?: number
          unit_weight_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_id: string | null
          actor_role: string
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          actor_role: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          buyer_note: string | null
          buyer_snapshot: Json
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmed_at: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          delivery_address: Json
          freight_minor: number | null
          id: string
          item_count: number
          order_number: string
          placed_at: string
          platform_fee_bps: number
          platform_fee_minor: number
          seller_business_id: string
          seller_snapshot: Json
          status: Database["public"]["Enums"]["order_status"]
          subtotal_minor: number
          total_minor: number
          total_weight_g: number
          updated_at: string
          version: number
        }
        Insert: {
          buyer_id: string
          buyer_note?: string | null
          buyer_snapshot: Json
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          delivery_address: Json
          freight_minor?: number | null
          id?: string
          item_count: number
          order_number: string
          placed_at?: string
          platform_fee_bps: number
          platform_fee_minor: number
          seller_business_id: string
          seller_snapshot: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_minor: number
          total_minor: number
          total_weight_g: number
          updated_at?: string
          version?: number
        }
        Update: {
          buyer_id?: string
          buyer_note?: string | null
          buyer_snapshot?: Json
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          delivery_address?: Json
          freight_minor?: number | null
          id?: string
          item_count?: number
          order_number?: string
          placed_at?: string
          platform_fee_bps?: number
          platform_fee_minor?: number
          seller_business_id?: string
          seller_snapshot?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_minor?: number
          total_minor?: number
          total_weight_g?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_business_id_fkey"
            columns: ["seller_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_minor: number
          buyer_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          expires_at: string
          fx_usd_lrd: number | null
          id: string
          order_id: string
          status: Database["public"]["Enums"]["payment_intent_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          buyer_id: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          expires_at: string
          fx_usd_lrd?: number | null
          id?: string
          order_id: string
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          buyer_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          expires_at?: string
          fx_usd_lrd?: number | null
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_minor: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          failure_reason: string | null
          id: string
          idempotency_key: string
          intent_id: string
          order_id: string
          payer_msisdn: string
          provider: Database["public"]["Enums"]["payment_provider_id"]
          provider_txn_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          intent_id: string
          order_id: string
          payer_msisdn: string
          provider: Database["public"]["Enums"]["payment_provider_id"]
          provider_txn_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          intent_id?: string
          order_id?: string
          payer_msisdn?: string
          provider?: Database["public"]["Enums"]["payment_provider_id"]
          provider_txn_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      payouts: {
        Row: {
          amount_minor: number
          attempts: number
          carrier_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          destination_msisdn: string | null
          failure_reason: string | null
          id: string
          order_id: string
          provider: Database["public"]["Enums"]["payment_provider_id"] | null
          provider_ref: string | null
          recipient: Database["public"]["Enums"]["payout_recipient"]
          seller_business_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          attempts?: number
          carrier_id?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          destination_msisdn?: string | null
          failure_reason?: string | null
          id?: string
          order_id: string
          provider?: Database["public"]["Enums"]["payment_provider_id"] | null
          provider_ref?: string | null
          recipient: Database["public"]["Enums"]["payout_recipient"]
          seller_business_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          attempts?: number
          carrier_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          destination_msisdn?: string | null
          failure_reason?: string | null
          id?: string
          order_id?: string
          provider?: Database["public"]["Enums"]["payment_provider_id"] | null
          provider_ref?: string | null
          recipient?: Database["public"]["Enums"]["payout_recipient"]
          seller_business_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_seller_business_id_fkey"
            columns: ["seller_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      provider_events: {
        Row: {
          amount_minor: number | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          event_id: string
          id: number
          outcome: string | null
          payload: Json
          processed_at: string | null
          provider: Database["public"]["Enums"]["payment_provider_id"]
          provider_txn_id: string | null
          received_at: string
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_minor?: number | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          event_id: string
          id?: never
          outcome?: string | null
          payload?: Json
          processed_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider_id"]
          provider_txn_id?: string | null
          received_at?: string
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_minor?: number | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          event_id?: string
          id?: never
          outcome?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider_id"]
          provider_txn_id?: string | null
          received_at?: string
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
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
      refunds: {
        Row: {
          amount_minor: number
          buyer_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          destination_msisdn: string
          escrow_id: string
          failure_reason: string | null
          id: string
          order_id: string
          provider_ref: string | null
          reason: string
          requested_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          buyer_id: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          destination_msisdn: string
          escrow_id: string
          failure_reason?: string | null
          id?: string
          order_id: string
          provider_ref?: string | null
          reason: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          buyer_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          destination_msisdn?: string
          escrow_id?: string
          failure_reason?: string | null
          id?: string
          order_id?: string
          provider_ref?: string | null
          reason?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrow_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      proforma_invoices: {
        Row: {
          id: string
          invoice_number: string
          issued_at: string
          order_id: string
          revision: number
          snapshot: Json
        }
        Insert: {
          id?: string
          invoice_number: string
          issued_at?: string
          order_id: string
          revision?: number
          snapshot: Json
        }
        Update: {
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id?: string
          revision?: number
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "proforma_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          cargo_volume_m3: number | null
          carrier_id: string
          created_at: string
          id: string
          is_active: boolean
          is_verified: boolean
          make_model: string | null
          payload_kg: number
          plate_number: string
          updated_at: string
          vehicle_class: Database["public"]["Enums"]["vehicle_class"] | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          verified_at: string | null
          year: number | null
        }
        Insert: {
          cargo_volume_m3?: number | null
          carrier_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          make_model?: string | null
          payload_kg: number
          plate_number: string
          updated_at?: string
          vehicle_class?: never
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          verified_at?: string | null
          year?: number | null
        }
        Update: {
          cargo_volume_m3?: number | null
          carrier_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          make_model?: string | null
          payload_kg?: number
          plate_number?: string
          updated_at?: string
          vehicle_class?: never
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          verified_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      ledger_balances: {
        Row: {
          account: string | null
          balance_minor: number | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          entries: number | null
        }
        Relationships: []
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
      admin_review_carrier: {
        Args: {
          p_carrier: string
          p_note?: string
          p_status: Database["public"]["Enums"]["carrier_verification_status"]
        }
        Returns: undefined
      }
      admin_set_vehicle_verified: {
        Args: { p_vehicle: string; p_verified: boolean }
        Returns: undefined
      }
      cancel_freight_rfq: {
        Args: { p_reason?: string; p_rfq: string }
        Returns: undefined
      }
      carrier_can_see_rfq: {
        Args: { p_rfq: string }
        Returns: boolean
      }
      admin_begin_payout: {
        Args: { p_msisdn: string; p_payout: string; p_provider: Database["public"]["Enums"]["payment_provider_id"] }
        Returns: boolean
      }
      admin_finish_payout: {
        Args: { p_failure?: string; p_payout: string; p_provider_ref?: string; p_success: boolean }
        Returns: boolean
      }
      admin_mark_refund: {
        Args: { p_failure?: string; p_paid: boolean; p_provider_ref?: string; p_refund: string }
        Returns: boolean
      }
      admin_refund_escrow: {
        Args: { p_order: string; p_reason: string }
        Returns: string
      }
      admin_release_escrow: {
        Args: { p_note: string; p_order: string }
        Returns: boolean
      }
      admin_retry_refund: {
        Args: { p_refund: string }
        Returns: undefined
      }
      can_view_order: { Args: { p_order: string }; Returns: boolean }
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
      create_freight_rfq: {
        Args: {
          p_order: string
          p_package_count?: number
          p_pickup_date: string
          p_preferred_delivery_date?: string
          p_special_instructions?: string
        }
        Returns: string
      }
      fee_for: { Args: { p_amount: number; p_bps: number }; Returns: number }
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
      is_rfq_buyer: {
        Args: { p_rfq: string }
        Returns: boolean
      }
      apply_provider_event: {
        Args: { p_amount_minor?: number; p_currency?: Database["public"]["Enums"]["currency_code"]; p_event_id: string; p_payload?: Json; p_provider: Database["public"]["Enums"]["payment_provider_id"]; p_provider_txn_id?: string; p_reference: string; p_status: Database["public"]["Enums"]["payment_status"] }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_business_member: { Args: { p_business: string }; Returns: boolean }
      is_verified_carrier: {
        Args: { p_carrier: string }
        Returns: boolean
      }
      issue_proforma: { Args: { p_order: string }; Returns: string }
      make_slug: { Args: { p_text: string }; Returns: string }
      owns_carrier_object: {
        Args: { p_name: string }
        Returns: boolean
      }
      provider_enabled: {
        Args: { p_provider: Database["public"]["Enums"]["payment_provider_id"] }
        Returns: boolean
      }
      record_payment_attempt: {
        Args: { p_failure?: string; p_provider_txn_id?: string; p_status: Database["public"]["Enums"]["payment_status"]; p_txn: string }
        Returns: undefined
      }
      place_orders: {
        Args: {
          p_address: string
          p_buyer_business_name?: string
          p_note?: string
        }
        Returns: string[]
      }
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
      select_freight_bid: {
        Args: { p_bid: string; p_expected_version?: number }
        Returns: string
      }
      set_exchange_rate: {
        Args: { p_base: Database["public"]["Enums"]["currency_code"]; p_note?: string; p_quote: Database["public"]["Enums"]["currency_code"]; p_rate: number }
        Returns: undefined
      }
      set_default_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      start_payment: {
        Args: { p_idempotency_key: string; p_msisdn: string; p_order: string; p_provider: Database["public"]["Enums"]["payment_provider_id"] }
        Returns: string
      }
      submit_carrier_for_review: {
        Args: never
        Returns: undefined
      }
      submit_freight_bid: {
        Args: {
          p_amount_minor: number
          p_delivery_date: string
          p_eta_hours: number
          p_note?: string
          p_rfq: string
          p_vehicle: string
        }
        Returns: string
      }
      tier_price: {
        Args: { p_product: string; p_qty: number }
        Returns: {
          max_qty: number
          min_qty: number
          unit_price_minor: number
        }[]
      }
      transition_order: {
        Args: {
          p_expected_version?: number
          p_note?: string
          p_order: string
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      update_platform_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      vehicle_class_for: {
        Args: { p_kg: number }
        Returns: Database["public"]["Enums"]["vehicle_class"]
      }
      withdraw_freight_bid: {
        Args: { p_bid: string }
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
      carrier_document_type:
        | "driver_license"
        | "national_id"
        | "passport"
        | "vehicle_registration"
        | "vehicle_insurance"
        | "other"
      carrier_verification_status:
        | "pending"
        | "under_review"
        | "verified"
        | "rejected"
        | "suspended"
      currency_code: "USD" | "LRD"
      escrow_status:
        | "held"
        | "released"
        | "refunded"
      freight_bid_status:
        | "submitted"
        | "withdrawn"
        | "accepted"
        | "rejected"
        | "expired"
      freight_rfq_status:
        | "open"
        | "awarded"
        | "cancelled"
        | "expired"
      payment_intent_status:
        | "requires_payment"
        | "processing"
        | "succeeded"
        | "cancelled"
        | "expired"
      payment_provider_id:
        | "sandbox"
        | "mtn_momo_lr"
        | "orange_money_lr"
      payment_status:
        | "initiated"
        | "pending"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "expired"
      payout_recipient:
        | "seller"
        | "carrier"
      payout_status:
        | "pending"
        | "initiated"
        | "paid"
        | "failed"
      order_status:
        | "draft"
        | "pending_seller"
        | "confirmed"
        | "fulfilling"
        | "ready_for_freight"
        | "freight_requested"
        | "carrier_selected"
        | "awaiting_payment"
        | "paid_escrow"
        | "in_transit"
        | "delivered"
        | "awaiting_confirmation"
        | "completed"
        | "cancelled"
        | "disputed"
        | "refunded"
        | "partially_refunded"
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
      vehicle_class:
        | "small"
        | "medium"
        | "large"
      vehicle_type:
        | "motorbike"
        | "tricycle"
        | "pickup"
        | "van"
        | "box_truck"
        | "flatbed_truck"
        | "tipper"
        | "container_truck"
        | "other"
      refund_status:
        | "pending"
        | "paid"
        | "failed"
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
      carrier_document_type: [
        "driver_license",
        "national_id",
        "passport",
        "vehicle_registration",
        "vehicle_insurance",
        "other",
      ],
      carrier_verification_status: [
        "pending",
        "under_review",
        "verified",
        "rejected",
        "suspended",
      ],
      currency_code: ["USD", "LRD"],
      escrow_status: [
        "held",
        "released",
        "refunded",
      ],
      freight_bid_status: [
        "submitted",
        "withdrawn",
        "accepted",
        "rejected",
        "expired",
      ],
      freight_rfq_status: [
        "open",
        "awarded",
        "cancelled",
        "expired",
      ],
      payment_intent_status: [
        "requires_payment",
        "processing",
        "succeeded",
        "cancelled",
        "expired",
      ],
      payment_provider_id: [
        "sandbox",
        "mtn_momo_lr",
        "orange_money_lr",
      ],
      payment_status: [
        "initiated",
        "pending",
        "succeeded",
        "failed",
        "cancelled",
        "expired",
      ],
      payout_recipient: [
        "seller",
        "carrier",
      ],
      payout_status: [
        "pending",
        "initiated",
        "paid",
        "failed",
      ],
      order_status: [
        "draft",
        "pending_seller",
        "confirmed",
        "fulfilling",
        "ready_for_freight",
        "freight_requested",
        "carrier_selected",
        "awaiting_payment",
        "paid_escrow",
        "in_transit",
        "delivered",
        "awaiting_confirmation",
        "completed",
        "cancelled",
        "disputed",
        "refunded",
        "partially_refunded",
      ],
      packaging_type: [
        "bag", "sack", "carton", "box", "crate", "drum", "jerrycan", "bottle", "tin",
        "bale", "bundle", "roll", "pallet", "piece", "other",
      ],
      product_status: ["draft", "active", "paused", "archived"],
      vehicle_class: [
        "small",
        "medium",
        "large",
      ],
      vehicle_type: [
        "motorbike",
        "tricycle",
        "pickup",
        "van",
        "box_truck",
        "flatbed_truck",
        "tipper",
        "container_truck",
        "other",
      ],
      refund_status: [
        "pending",
        "paid",
        "failed",
      ],
      role_status: ["active", "revoked"],
    },
  },
} as const
