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
      accommodation_photos: {
        Row: {
          accommodation_id: string | null
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean
          room_id: string | null
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          accommodation_id?: string | null
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          room_id?: string | null
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          accommodation_id?: string | null
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          room_id?: string | null
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_photos_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_photos_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "accommodation_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodation_room_characteristics: {
        Row: {
          created_at: string
          id: string
          name: string
          room_id: string
          sort_order: number
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          room_id: string
          sort_order?: number
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          room_id?: string
          sort_order?: number
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_room_characteristics_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "accommodation_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodation_rooms: {
        Row: {
          accommodation_id: string
          active: boolean
          created_at: string
          customer_price_per_night_idr: number
          description: string | null
          id: string
          internal_name: string
          internal_notes: string | null
          internal_reference: string | null
          max_guests: number
          public_name: string | null
          sort_order: number
          supplier_cost_per_night_idr: number
          updated_at: string
        }
        Insert: {
          accommodation_id: string
          active?: boolean
          created_at?: string
          customer_price_per_night_idr?: number
          description?: string | null
          id?: string
          internal_name: string
          internal_notes?: string | null
          internal_reference?: string | null
          max_guests?: number
          public_name?: string | null
          sort_order?: number
          supplier_cost_per_night_idr?: number
          updated_at?: string
        }
        Update: {
          accommodation_id?: string
          active?: boolean
          created_at?: string
          customer_price_per_night_idr?: number
          description?: string | null
          id?: string
          internal_name?: string
          internal_notes?: string | null
          internal_reference?: string | null
          max_guests?: number
          public_name?: string | null
          sort_order?: number
          supplier_cost_per_night_idr?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_rooms_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodations: {
        Row: {
          accommodation_type: Database["public"]["Enums"]["accommodation_type"]
          active: boolean
          catalogue_id: string
          created_at: string
          description: string | null
          id: string
          internal_name: string
          internal_notes: string | null
          internal_reference: string | null
          location: string | null
          public_name: string | null
          sort_order: number
          supplier_contact: string | null
          updated_at: string
        }
        Insert: {
          accommodation_type?: Database["public"]["Enums"]["accommodation_type"]
          active?: boolean
          catalogue_id: string
          created_at?: string
          description?: string | null
          id?: string
          internal_name: string
          internal_notes?: string | null
          internal_reference?: string | null
          location?: string | null
          public_name?: string | null
          sort_order?: number
          supplier_contact?: string | null
          updated_at?: string
        }
        Update: {
          accommodation_type?: Database["public"]["Enums"]["accommodation_type"]
          active?: boolean
          catalogue_id?: string
          created_at?: string
          description?: string | null
          id?: string
          internal_name?: string
          internal_notes?: string | null
          internal_reference?: string | null
          location?: string | null
          public_name?: string | null
          sort_order?: number
          supplier_contact?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_ref: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_ref?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_ref?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      cart_packages: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          package_id: string
          position: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          package_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          package_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_packages_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          currency_code: string | null
          id: string
          market_code: string | null
          session_token: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string | null
          id?: string
          market_code?: string | null
          session_token: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string | null
          id?: string
          market_code?: string | null
          session_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "carts_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      catalogues: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          hours_label: string | null
          id: string
          internal_name: string
          people_label: string | null
          public_name: string | null
          sort_order: number
          template: Database["public"]["Enums"]["catalogue_template"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          hours_label?: string | null
          id?: string
          internal_name: string
          people_label?: string | null
          public_name?: string | null
          sort_order?: number
          template: Database["public"]["Enums"]["catalogue_template"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          hours_label?: string | null
          id?: string
          internal_name?: string
          people_label?: string | null
          public_name?: string | null
          sort_order?: number
          template?: Database["public"]["Enums"]["catalogue_template"]
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      component_templates: {
        Row: {
          created_at: string
          customer_description: string | null
          customer_name: string | null
          customer_price: number
          default_quantity: number | null
          id: string
          internal_cost: number
          internal_name: string
          is_active: boolean
          max_quantity: number | null
          min_quantity: number
          promo_eligible: boolean
          season_eligible: boolean
          unit_basis: Database["public"]["Enums"]["unit_basis"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_description?: string | null
          customer_name?: string | null
          customer_price?: number
          default_quantity?: number | null
          id?: string
          internal_cost?: number
          internal_name: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity?: number
          promo_eligible?: boolean
          season_eligible?: boolean
          unit_basis?: Database["public"]["Enums"]["unit_basis"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_description?: string | null
          customer_name?: string | null
          customer_price?: number
          default_quantity?: number | null
          id?: string
          internal_cost?: number
          internal_name?: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity?: number
          promo_eligible?: boolean
          season_eligible?: boolean
          unit_basis?: Database["public"]["Enums"]["unit_basis"]
          updated_at?: string
        }
        Relationships: []
      }
      config_flows: {
        Row: {
          created_at: string
          id: string
          internal_name: string | null
          is_active: boolean
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_name?: string | null
          is_active?: boolean
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_name?: string | null
          is_active?: boolean
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_flows_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          cart_id: string | null
          created_at: string
          email: string
          email_error: string | null
          email_status: string
          full_name: string
          id: string
          message: string
          phone: string | null
          updated_at: string
          voucher_codes: string[]
        }
        Insert: {
          cart_id?: string | null
          created_at?: string
          email: string
          email_error?: string | null
          email_status?: string
          full_name: string
          id?: string
          message: string
          phone?: string | null
          updated_at?: string
          voucher_codes?: string[]
        }
        Update: {
          cart_id?: string | null
          created_at?: string
          email?: string
          email_error?: string | null
          email_status?: string
          full_name?: string
          id?: string
          message?: string
          phone?: string | null
          updated_at?: string
          voucher_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          display_order: number
          is_active: boolean
          is_base: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          is_active?: boolean
          is_base?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          is_active?: boolean
          is_base?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          preferred_language_code: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone: string
          preferred_language_code?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          preferred_language_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_preferred_language_code_fkey"
            columns: ["preferred_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      dependencies: {
        Row: {
          action: Database["public"]["Enums"]["dependency_action"]
          action_value: string | null
          compare_value: string | null
          created_at: string
          id: string
          is_active: boolean
          operator: string
          product_id: string
          source_field_id: string
          source_option_id: string | null
          target_field_id: string | null
          target_option_id: string | null
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["dependency_action"]
          action_value?: string | null
          compare_value?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          operator: string
          product_id: string
          source_field_id: string
          source_option_id?: string | null
          target_field_id?: string | null
          target_option_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["dependency_action"]
          action_value?: string | null
          compare_value?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          operator?: string
          product_id?: string
          source_field_id?: string
          source_option_id?: string | null
          target_field_id?: string | null
          target_option_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependencies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_source_field_id_fkey"
            columns: ["source_field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_source_option_id_fkey"
            columns: ["source_option_id"]
            isOneToOne: false
            referencedRelation: "field_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_target_field_id_fkey"
            columns: ["target_field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_target_option_id_fkey"
            columns: ["target_option_id"]
            isOneToOne: false
            referencedRelation: "field_options"
            referencedColumns: ["id"]
          },
        ]
      }
      field_options: {
        Row: {
          created_at: string
          customer_label: string | null
          description: string | null
          display_order: number
          field_id: string
          id: string
          internal_value: string
          is_active: boolean
          is_default: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_label?: string | null
          description?: string | null
          display_order?: number
          field_id: string
          id?: string
          internal_value: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_label?: string | null
          description?: string | null
          display_order?: number
          field_id?: string
          id?: string
          internal_value?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          catalogue_id: string | null
          catalogue_type:
            | Database["public"]["Enums"]["catalogue_source_type"]
            | null
          created_at: string
          customer_label: string | null
          default_value: string | null
          display_order: number
          field_type: Database["public"]["Enums"]["field_type"]
          help_text: string | null
          id: string
          internal_name: string
          is_active: boolean
          is_required: boolean
          max_value: number | null
          min_value: number | null
          option_source: string
          photo_display_size: string
          product_id: string
          step_id: string
          updated_at: string
          variable_name: string
        }
        Insert: {
          catalogue_id?: string | null
          catalogue_type?:
            | Database["public"]["Enums"]["catalogue_source_type"]
            | null
          created_at?: string
          customer_label?: string | null
          default_value?: string | null
          display_order?: number
          field_type: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          internal_name: string
          is_active?: boolean
          is_required?: boolean
          max_value?: number | null
          min_value?: number | null
          option_source?: string
          photo_display_size?: string
          product_id: string
          step_id: string
          updated_at?: string
          variable_name: string
        }
        Update: {
          catalogue_id?: string | null
          catalogue_type?:
            | Database["public"]["Enums"]["catalogue_source_type"]
            | null
          created_at?: string
          customer_label?: string | null
          default_value?: string | null
          display_order?: number
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          internal_name?: string
          is_active?: boolean
          is_required?: boolean
          max_value?: number | null
          min_value?: number | null
          option_source?: string
          photo_display_size?: string
          product_id?: string
          step_id?: string
          updated_at?: string
          variable_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_versions: {
        Row: {
          activated_at: string | null
          created_at: string
          created_by: string | null
          expression: string
          id: string
          is_active: boolean
          pricing_id: string
          updated_at: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          created_by?: string | null
          expression: string
          id?: string
          is_active?: boolean
          pricing_id: string
          updated_at?: string
          version: number
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          created_by?: string | null
          expression?: string
          id?: string
          is_active?: boolean
          pricing_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "formula_versions_pricing_id_fkey"
            columns: ["pricing_id"]
            isOneToOne: false
            referencedRelation: "product_pricing"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base_currency_code: string
          created_at: string
          effective_at: string
          id: string
          is_current: boolean
          quote_currency_code: string
          rate: number
          source: string
          updated_at: string
        }
        Insert: {
          base_currency_code?: string
          created_at?: string
          effective_at?: string
          id?: string
          is_current?: boolean
          quote_currency_code: string
          rate: number
          source?: string
          updated_at?: string
        }
        Update: {
          base_currency_code?: string
          created_at?: string
          effective_at?: string
          id?: string
          is_current?: boolean
          quote_currency_code?: string
          rate?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_base_currency_code_fkey"
            columns: ["base_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_rates_quote_currency_code_fkey"
            columns: ["quote_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string
          display_order: number
          is_active: boolean
          is_master: boolean
          name: string
          native_name: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          is_active?: boolean
          is_master?: boolean
          name: string
          native_name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          is_active?: boolean
          is_master?: boolean
          name?: string
          native_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          code: string
          created_at: string
          default_currency_code: string
          default_language_code: string
          display_order: number
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_currency_code: string
          default_language_code: string
          display_order?: number
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_currency_code?: string
          default_language_code?: string
          display_order?: number
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_default_currency_code_fkey"
            columns: ["default_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "markets_default_language_code_fkey"
            columns: ["default_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      motorbikes: {
        Row: {
          active: boolean
          catalogue_id: string
          created_at: string
          customer_price_idr: number
          description: string | null
          id: string
          internal_name: string
          internal_notes: string | null
          internal_reference: string | null
          photo_path: string | null
          public_name: string | null
          sort_order: number
          supplier_cost_idr: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          catalogue_id: string
          created_at?: string
          customer_price_idr?: number
          description?: string | null
          id?: string
          internal_name: string
          internal_notes?: string | null
          internal_reference?: string | null
          photo_path?: string | null
          public_name?: string | null
          sort_order?: number
          supplier_cost_idr?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          catalogue_id?: string
          created_at?: string
          customer_price_idr?: number
          description?: string | null
          id?: string
          internal_name?: string
          internal_notes?: string | null
          internal_reference?: string | null
          photo_path?: string | null
          public_name?: string | null
          sort_order?: number
          supplier_cost_idr?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorbikes_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          answers: Json
          catalogue_id: string | null
          catalogue_item_id: string | null
          catalogue_selections: Json
          catalogue_type:
            | Database["public"]["Enums"]["catalogue_source_type"]
            | null
          created_at: string
          id: string
          item_title: string | null
          line_kind: string
          product_id: string | null
          promo_code: string | null
          promo_code_id: string | null
          promo_discount_idr: number
          quote_lines: Json
          quoted_at: string | null
          resolved_inputs: Json
          season_discount_idr: number
          season_month: number | null
          season_period: Database["public"]["Enums"]["season_period"] | null
          status: string
          subtotal_idr: number
          total_idr: number
          updated_at: string
        }
        Insert: {
          answers?: Json
          catalogue_id?: string | null
          catalogue_item_id?: string | null
          catalogue_selections?: Json
          catalogue_type?:
            | Database["public"]["Enums"]["catalogue_source_type"]
            | null
          created_at?: string
          id?: string
          item_title?: string | null
          line_kind?: string
          product_id?: string | null
          promo_code?: string | null
          promo_code_id?: string | null
          promo_discount_idr?: number
          quote_lines?: Json
          quoted_at?: string | null
          resolved_inputs?: Json
          season_discount_idr?: number
          season_month?: number | null
          season_period?: Database["public"]["Enums"]["season_period"] | null
          status?: string
          subtotal_idr?: number
          total_idr?: number
          updated_at?: string
        }
        Update: {
          answers?: Json
          catalogue_id?: string | null
          catalogue_item_id?: string | null
          catalogue_selections?: Json
          catalogue_type?:
            | Database["public"]["Enums"]["catalogue_source_type"]
            | null
          created_at?: string
          id?: string
          item_title?: string | null
          line_kind?: string
          product_id?: string | null
          promo_code?: string | null
          promo_code_id?: string | null
          promo_discount_idr?: number
          quote_lines?: Json
          quoted_at?: string | null
          resolved_inputs?: Json
          season_discount_idr?: number
          season_month?: number | null
          season_period?: Database["public"]["Enums"]["season_period"] | null
          status?: string
          subtotal_idr?: number
          total_idr?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          payment_request_id: string | null
          provider: string
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          payment_request_id?: string | null
          provider: string
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_request_id?: string | null
          provider?: string
          provider_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          amount_idr: number
          created_at: string
          currency_code: string
          customer_amount: number | null
          customer_currency_code: string | null
          expires_at: string | null
          fx_rate: number | null
          id: string
          kind: Database["public"]["Enums"]["payment_request_kind"]
          paid_at: string | null
          provider: string | null
          provider_payment_url: string | null
          provider_reference: string | null
          purchase_id: string
          status: Database["public"]["Enums"]["payment_request_status"]
          updated_at: string
        }
        Insert: {
          amount_idr: number
          created_at?: string
          currency_code?: string
          customer_amount?: number | null
          customer_currency_code?: string | null
          expires_at?: string | null
          fx_rate?: number | null
          id?: string
          kind: Database["public"]["Enums"]["payment_request_kind"]
          paid_at?: string | null
          provider?: string | null
          provider_payment_url?: string | null
          provider_reference?: string | null
          purchase_id: string
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
        }
        Update: {
          amount_idr?: number
          created_at?: string
          currency_code?: string
          customer_amount?: number | null
          customer_currency_code?: string | null
          expires_at?: string | null
          fx_rate?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_request_kind"]
          paid_at?: string | null
          provider?: string | null
          provider_payment_url?: string | null
          provider_reference?: string | null
          purchase_id?: string
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payment_requests_customer_currency_code_fkey"
            columns: ["customer_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payment_requests_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      placements: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          amount_idr: number | null
          component_id: string | null
          condition_operator: string | null
          condition_value: string | null
          condition_variable: string | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          label: string
          pricing_id: string
          quantity_variable: string | null
          rule_type: Database["public"]["Enums"]["pricing_rule_type"]
          sign: Database["public"]["Enums"]["pricing_sign"]
          updated_at: string
          variable_name: string | null
        }
        Insert: {
          amount_idr?: number | null
          component_id?: string | null
          condition_operator?: string | null
          condition_value?: string | null
          condition_variable?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          pricing_id: string
          quantity_variable?: string | null
          rule_type: Database["public"]["Enums"]["pricing_rule_type"]
          sign?: Database["public"]["Enums"]["pricing_sign"]
          updated_at?: string
          variable_name?: string | null
        }
        Update: {
          amount_idr?: number | null
          component_id?: string | null
          condition_operator?: string | null
          condition_value?: string | null
          condition_variable?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          pricing_id?: string
          quantity_variable?: string | null
          rule_type?: Database["public"]["Enums"]["pricing_rule_type"]
          sign?: Database["public"]["Enums"]["pricing_sign"]
          updated_at?: string
          variable_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "product_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_pricing_id_fkey"
            columns: ["pricing_id"]
            isOneToOne: false
            referencedRelation: "product_pricing"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_test_cases: {
        Row: {
          created_at: string
          expected_total_idr: number | null
          id: string
          inputs: Json
          label: string
          pricing_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_total_idr?: number | null
          id?: string
          inputs?: Json
          label: string
          pricing_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_total_idr?: number | null
          id?: string
          inputs?: Json
          label?: string
          pricing_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_test_cases_pricing_id_fkey"
            columns: ["pricing_id"]
            isOneToOne: false
            referencedRelation: "product_pricing"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          amount_idr: number
          created_at: string
          display_order: number
          from_value: number
          id: string
          rule_id: string
          to_value: number | null
          updated_at: string
        }
        Insert: {
          amount_idr: number
          created_at?: string
          display_order?: number
          from_value: number
          id?: string
          rule_id: string
          to_value?: number | null
          updated_at?: string
        }
        Update: {
          amount_idr?: number
          created_at?: string
          display_order?: number
          from_value?: number
          id?: string
          rule_id?: string
          to_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tiers_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_components: {
        Row: {
          created_at: string
          customer_description: string | null
          customer_name: string | null
          customer_price: number
          default_quantity: number | null
          display_order: number
          id: string
          internal_cost: number
          internal_name: string
          is_active: boolean
          max_quantity: number | null
          min_quantity: number
          product_id: string
          promo_eligible: boolean
          season_eligible: boolean
          source_template_id: string | null
          unit_basis: Database["public"]["Enums"]["unit_basis"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_description?: string | null
          customer_name?: string | null
          customer_price?: number
          default_quantity?: number | null
          display_order?: number
          id?: string
          internal_cost?: number
          internal_name: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity?: number
          product_id: string
          promo_eligible?: boolean
          season_eligible?: boolean
          source_template_id?: string | null
          unit_basis?: Database["public"]["Enums"]["unit_basis"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_description?: string | null
          customer_name?: string | null
          customer_price?: number
          default_quantity?: number | null
          display_order?: number
          id?: string
          internal_cost?: number
          internal_name?: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity?: number
          product_id?: string
          promo_eligible?: boolean
          season_eligible?: boolean
          source_template_id?: string | null
          unit_basis?: Database["public"]["Enums"]["unit_basis"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "component_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_placements: {
        Row: {
          created_at: string
          display_order: number
          placement_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          placement_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          placement_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_placements_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_placements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing: {
        Row: {
          active_version_id: string | null
          base_amount_idr: number
          created_at: string
          days_variable: string | null
          id: string
          mode: Database["public"]["Enums"]["pricing_mode"]
          nights_variable: string | null
          notes: string | null
          people_variable: string | null
          product_id: string
          sessions_variable: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          base_amount_idr?: number
          created_at?: string
          days_variable?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["pricing_mode"]
          nights_variable?: string | null
          notes?: string | null
          people_variable?: string | null
          product_id: string
          sessions_variable?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          base_amount_idr?: number
          created_at?: string
          days_variable?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["pricing_mode"]
          nights_variable?: string | null
          notes?: string | null
          people_variable?: string | null
          product_id?: string
          sessions_variable?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_active_version_fkey"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_season_months: {
        Row: {
          created_at: string
          id: string
          month: number
          period: Database["public"]["Enums"]["season_period"]
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          period: Database["public"]["Enums"]["season_period"]
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          period?: Database["public"]["Enums"]["season_period"]
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_season_months_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_season_periods: {
        Row: {
          created_at: string
          discount_percentage: number
          id: string
          period: Database["public"]["Enums"]["season_period"]
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percentage?: number
          id?: string
          period: Database["public"]["Enums"]["season_period"]
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percentage?: number
          id?: string
          period?: Database["public"]["Enums"]["season_period"]
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_season_periods_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_season_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_season_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          body: string | null
          created_at: string
          id: string
          language_code: string
          product_id: string
          seo_description: string | null
          seo_title: string | null
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          language_code: string
          product_id: string
          seo_description?: string | null
          seo_title?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          language_code?: string
          product_id?: string
          seo_description?: string | null
          seo_title?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          internal_name: string
          internal_ref: string | null
          kind: Database["public"]["Enums"]["product_kind"]
          sort_order: number
          status: string
          updated_at: string
          voucher_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          internal_name: string
          internal_ref?: string | null
          kind: Database["public"]["Enums"]["product_kind"]
          sort_order?: number
          status?: string
          updated_at?: string
          voucher_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          internal_name?: string
          internal_ref?: string | null
          kind?: Database["public"]["Enums"]["product_kind"]
          sort_order?: number
          status?: string
          updated_at?: string
          voucher_name?: string | null
        }
        Relationships: []
      }
      promo_code_categories: {
        Row: {
          category_id: string
          created_at: string
          promo_code_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          promo_code_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          promo_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_categories_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_products: {
        Row: {
          created_at: string
          product_id: string
          promo_code_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          promo_code_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          promo_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_products_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_percentage: number
          expires_at: string | null
          gift_eligible: boolean
          id: string
          internal_name: string
          notes: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_percentage: number
          expires_at?: string | null
          gift_eligible?: boolean
          id?: string
          internal_name: string
          notes?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_percentage?: number
          expires_at?: string | null
          gift_eligible?: boolean
          id?: string
          internal_name?: string
          notes?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: string
          purchase_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          purchase_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_snapshots_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          cart_id: string
          created_at: string
          currency_code: string
          customer_currency_code: string | null
          customer_first_payment_amount: number | null
          customer_id: string | null
          customer_outstanding_amount: number | null
          customer_total_amount: number | null
          first_payment_idr: number
          first_payment_percentage: number
          fulfillment_status: Database["public"]["Enums"]["purchase_fulfillment_status"]
          fx_effective_at: string | null
          fx_rate: number | null
          gift_message: string | null
          gift_recipient_name: string | null
          id: string
          is_gift: boolean
          outstanding_idr: number
          paid_idr: number
          reference: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          total_idr: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          currency_code?: string
          customer_currency_code?: string | null
          customer_first_payment_amount?: number | null
          customer_id?: string | null
          customer_outstanding_amount?: number | null
          customer_total_amount?: number | null
          first_payment_idr: number
          first_payment_percentage: number
          fulfillment_status?: Database["public"]["Enums"]["purchase_fulfillment_status"]
          fx_effective_at?: string | null
          fx_rate?: number | null
          gift_message?: string | null
          gift_recipient_name?: string | null
          id?: string
          is_gift?: boolean
          outstanding_idr: number
          paid_idr?: number
          reference?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          total_idr: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          currency_code?: string
          customer_currency_code?: string | null
          customer_first_payment_amount?: number | null
          customer_id?: string | null
          customer_outstanding_amount?: number | null
          customer_total_amount?: number | null
          first_payment_idr?: number
          first_payment_percentage?: number
          fulfillment_status?: Database["public"]["Enums"]["purchase_fulfillment_status"]
          fx_effective_at?: string | null
          fx_rate?: number | null
          gift_message?: string | null
          gift_recipient_name?: string | null
          id?: string
          is_gift?: boolean
          outstanding_idr?: number
          paid_idr?: number
          reference?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          total_idr?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: true
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "purchases_customer_currency_code_fkey"
            columns: ["customer_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_trips: {
        Row: {
          cart_id: string | null
          code: string
          created_at: string
          expires_at: string
          id: string
          lines: Json
          updated_at: string
        }
        Insert: {
          cart_id?: string | null
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          lines: Json
          updated_at?: string
        }
        Update: {
          cart_id?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          lines?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_trips_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: string
          value_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: string
          value_type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
          value_type?: string
        }
        Relationships: []
      }
      steps: {
        Row: {
          created_at: string
          customer_description: string | null
          customer_title: string | null
          display_order: number
          flow_id: string
          id: string
          internal_name: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_description?: string | null
          customer_title?: string | null
          display_order?: number
          flow_id: string
          id?: string
          internal_name: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_description?: string | null
          customer_title?: string | null
          display_order?: number
          flow_id?: string
          id?: string
          internal_name?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "config_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_people_prices: {
        Row: {
          created_at: string
          customer_price_idr: number
          id: string
          people: number
          supplier_cost_idr: number
          transport_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_price_idr?: number
          id?: string
          people: number
          supplier_cost_idr?: number
          transport_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_price_idr?: number
          id?: string
          people?: number
          supplier_cost_idr?: number
          transport_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_people_prices_transport_id_fkey"
            columns: ["transport_id"]
            isOneToOne: false
            referencedRelation: "transports"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_time_prices: {
        Row: {
          created_at: string
          customer_price_idr: number
          id: string
          supplier_cost_idr: number
          transport_id: string
          travel_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_price_idr?: number
          id?: string
          supplier_cost_idr?: number
          transport_id: string
          travel_hours: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_price_idr?: number
          id?: string
          supplier_cost_idr?: number
          transport_id?: string
          travel_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_time_prices_transport_id_fkey"
            columns: ["transport_id"]
            isOneToOne: false
            referencedRelation: "transports"
            referencedColumns: ["id"]
          },
        ]
      }
      transports: {
        Row: {
          active: boolean
          calc_mode: string
          catalogue_id: string
          created_at: string
          description: string | null
          destination: string | null
          id: string
          internal_name: string
          internal_notes: string | null
          internal_reference: string | null
          max_travel_hours: number | null
          min_travel_hours: number | null
          origin: string | null
          public_name: string | null
          sort_order: number
          transport_type: Database["public"]["Enums"]["transport_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          calc_mode?: string
          catalogue_id: string
          created_at?: string
          description?: string | null
          destination?: string | null
          id?: string
          internal_name: string
          internal_notes?: string | null
          internal_reference?: string | null
          max_travel_hours?: number | null
          min_travel_hours?: number | null
          origin?: string | null
          public_name?: string | null
          sort_order?: number
          transport_type: Database["public"]["Enums"]["transport_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          calc_mode?: string
          catalogue_id?: string
          created_at?: string
          description?: string | null
          destination?: string | null
          id?: string
          internal_name?: string
          internal_notes?: string | null
          internal_reference?: string | null
          max_travel_hours?: number | null
          min_travel_hours?: number | null
          origin?: string | null
          public_name?: string | null
          sort_order?: number
          transport_type?: Database["public"]["Enums"]["transport_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transports_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      voucher_sequences: {
        Row: {
          created_at: string
          last_value: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          last_value?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          last_value?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          auto_delivery_at: string | null
          cancelled_at: string | null
          cart_id: string | null
          cart_snapshot: Json | null
          code: string
          created_at: string
          customer_id: string | null
          document_error: string | null
          document_generated_at: string | null
          document_path: string | null
          document_status: string
          email_attempts: number
          email_error: string | null
          email_recipient: string | null
          email_sent_at: string | null
          email_status: string
          entitlement: Json
          gift_message: string | null
          gift_recipient_name: string | null
          id: string
          issued_at: string
          package_id: string | null
          purchase_id: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          redemption_note: string | null
          representation_version: number
          status: Database["public"]["Enums"]["voucher_status"]
          updated_at: string
          valid_until: string
          validity_months: number
          voucher_type: Database["public"]["Enums"]["voucher_type"]
        }
        Insert: {
          auto_delivery_at?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          cart_snapshot?: Json | null
          code: string
          created_at?: string
          customer_id?: string | null
          document_error?: string | null
          document_generated_at?: string | null
          document_path?: string | null
          document_status?: string
          email_attempts?: number
          email_error?: string | null
          email_recipient?: string | null
          email_sent_at?: string | null
          email_status?: string
          entitlement?: Json
          gift_message?: string | null
          gift_recipient_name?: string | null
          id?: string
          issued_at?: string
          package_id?: string | null
          purchase_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          redemption_note?: string | null
          representation_version?: number
          status?: Database["public"]["Enums"]["voucher_status"]
          updated_at?: string
          valid_until: string
          validity_months: number
          voucher_type?: Database["public"]["Enums"]["voucher_type"]
        }
        Update: {
          auto_delivery_at?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          cart_snapshot?: Json | null
          code?: string
          created_at?: string
          customer_id?: string | null
          document_error?: string | null
          document_generated_at?: string | null
          document_path?: string | null
          document_status?: string
          email_attempts?: number
          email_error?: string | null
          email_recipient?: string | null
          email_sent_at?: string | null
          email_status?: string
          entitlement?: Json
          gift_message?: string | null
          gift_recipient_name?: string | null
          id?: string
          issued_at?: string
          package_id?: string | null
          purchase_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          redemption_note?: string | null
          representation_version?: number
          status?: Database["public"]["Enums"]["voucher_status"]
          updated_at?: string
          valid_until?: string
          validity_months?: number
          voucher_type?: Database["public"]["Enums"]["voucher_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      website_block_catalogues: {
        Row: {
          block_id: string
          catalogue_id: string
          created_at: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          block_id: string
          catalogue_id: string
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          block_id?: string
          catalogue_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_block_catalogues_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "website_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_block_catalogues_catalogue_id_fkey"
            columns: ["catalogue_id"]
            isOneToOne: false
            referencedRelation: "catalogues"
            referencedColumns: ["id"]
          },
        ]
      }
      website_block_products: {
        Row: {
          block_id: string
          created_at: string
          id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          block_id: string
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          block_id?: string
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "website_block_products_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "website_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_block_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      website_block_translations: {
        Row: {
          block_id: string
          body: string | null
          created_at: string
          cta_label: string | null
          id: string
          language_code: string
          title: string | null
          updated_at: string
        }
        Insert: {
          block_id: string
          body?: string | null
          created_at?: string
          cta_label?: string | null
          id?: string
          language_code: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          block_id?: string
          body?: string | null
          created_at?: string
          cta_label?: string | null
          id?: string
          language_code?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_block_translations_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "website_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_block_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      website_blocks: {
        Row: {
          block_kind: Database["public"]["Enums"]["website_block_kind"]
          created_at: string
          cta_external_url: string | null
          cta_kind: Database["public"]["Enums"]["website_destination_kind"]
          cta_page_id: string | null
          cta_product_id: string | null
          id: string
          internal_name: string
          is_active: boolean
          media_kind: string | null
          media_path: string | null
          section_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          block_kind: Database["public"]["Enums"]["website_block_kind"]
          created_at?: string
          cta_external_url?: string | null
          cta_kind?: Database["public"]["Enums"]["website_destination_kind"]
          cta_page_id?: string | null
          cta_product_id?: string | null
          id?: string
          internal_name: string
          is_active?: boolean
          media_kind?: string | null
          media_path?: string | null
          section_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          block_kind?: Database["public"]["Enums"]["website_block_kind"]
          created_at?: string
          cta_external_url?: string | null
          cta_kind?: Database["public"]["Enums"]["website_destination_kind"]
          cta_page_id?: string | null
          cta_product_id?: string | null
          id?: string
          internal_name?: string
          is_active?: boolean
          media_kind?: string | null
          media_path?: string | null
          section_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_blocks_cta_page_id_fkey"
            columns: ["cta_page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_blocks_cta_product_id_fkey"
            columns: ["cta_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_blocks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "website_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      website_landing: {
        Row: {
          created_at: string
          cta_external_url: string | null
          cta_kind: Database["public"]["Enums"]["website_destination_kind"]
          cta_page_id: string | null
          cta_product_id: string | null
          id: string
          image_alt: string | null
          image_path: string | null
          is_active: boolean
          singleton: boolean
          updated_at: string
          video_path: string | null
        }
        Insert: {
          created_at?: string
          cta_external_url?: string | null
          cta_kind?: Database["public"]["Enums"]["website_destination_kind"]
          cta_page_id?: string | null
          cta_product_id?: string | null
          id?: string
          image_alt?: string | null
          image_path?: string | null
          is_active?: boolean
          singleton?: boolean
          updated_at?: string
          video_path?: string | null
        }
        Update: {
          created_at?: string
          cta_external_url?: string | null
          cta_kind?: Database["public"]["Enums"]["website_destination_kind"]
          cta_page_id?: string | null
          cta_product_id?: string | null
          id?: string
          image_alt?: string | null
          image_path?: string | null
          is_active?: boolean
          singleton?: boolean
          updated_at?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_landing_cta_page_id_fkey"
            columns: ["cta_page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_landing_cta_product_id_fkey"
            columns: ["cta_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      website_landing_translations: {
        Row: {
          created_at: string
          cta_label: string | null
          id: string
          landing_id: string
          language_code: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          id?: string
          landing_id: string
          language_code: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          id?: string
          landing_id?: string
          language_code?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_landing_translations_landing_id_fkey"
            columns: ["landing_id"]
            isOneToOne: false
            referencedRelation: "website_landing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_landing_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      website_nav_item_translations: {
        Row: {
          created_at: string
          id: string
          label: string | null
          language_code: string
          nav_item_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          language_code: string
          nav_item_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          language_code?: string
          nav_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_nav_item_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "website_nav_item_translations_nav_item_id_fkey"
            columns: ["nav_item_id"]
            isOneToOne: false
            referencedRelation: "website_nav_items"
            referencedColumns: ["id"]
          },
        ]
      }
      website_nav_items: {
        Row: {
          created_at: string
          destination_external_url: string | null
          destination_kind: Database["public"]["Enums"]["website_destination_kind"]
          destination_page_id: string | null
          destination_product_id: string | null
          id: string
          internal_name: string
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_external_url?: string | null
          destination_kind?: Database["public"]["Enums"]["website_destination_kind"]
          destination_page_id?: string | null
          destination_product_id?: string | null
          id?: string
          internal_name: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_external_url?: string | null
          destination_kind?: Database["public"]["Enums"]["website_destination_kind"]
          destination_page_id?: string | null
          destination_product_id?: string | null
          id?: string
          internal_name?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_nav_items_destination_page_id_fkey"
            columns: ["destination_page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_nav_items_destination_product_id_fkey"
            columns: ["destination_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      website_page_translations: {
        Row: {
          created_at: string
          id: string
          language_code: string
          page_id: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_code: string
          page_id: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language_code?: string
          page_id?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_page_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "website_page_translations_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      website_pages: {
        Row: {
          created_at: string
          id: string
          internal_name: string
          is_active: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_name: string
          is_active?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_name?: string
          is_active?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      website_section_translations: {
        Row: {
          created_at: string
          id: string
          language_code: string
          section_id: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_code: string
          section_id: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language_code?: string
          section_id?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_section_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "website_section_translations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "website_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      website_sections: {
        Row: {
          created_at: string
          id: string
          internal_name: string
          is_active: boolean
          page_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_name: string
          is_active?: boolean
          page_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_name?: string
          is_active?: boolean
          page_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_pricing_variable: {
        Args: { _name: string; _product_id: string }
        Returns: undefined
      }
      create_purchase:
        | {
            Args: {
              _cart_id: string
              _customer_id: string
              _first_payment_idr: number
              _outstanding_idr: number
              _percentage: number
              _snapshot: Json
              _total_idr: number
            }
            Returns: string
          }
        | {
            Args: {
              _cart_id: string
              _customer_id: string
              _first_payment_idr: number
              _gift_message?: string
              _gift_recipient_name?: string
              _is_gift?: boolean
              _outstanding_idr: number
              _percentage: number
              _snapshot: Json
              _total_idr: number
            }
            Returns: string
          }
      duplicate_accommodation_room: {
        Args: { _source: string }
        Returns: string
      }
      duplicate_catalogue: { Args: { _source: string }; Returns: string }
      duplicate_motorbike: { Args: { _source: string }; Returns: string }
      duplicate_product: { Args: { _source: string }; Returns: string }
      duplicate_transport: { Args: { _source: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: never; Returns: boolean }
      issue_voucher: {
        Args: {
          _entitlement: Json
          _package_id: string
          _purchase_id: string
          _validity_months: number
        }
        Returns: string
      }
      next_voucher_code: { Args: never; Returns: string }
      rename_pricing_variable: {
        Args: { _new: string; _old: string; _product_id: string }
        Returns: undefined
      }
    }
    Enums: {
      accommodation_type: "hotel" | "beach_camping"
      catalogue_source_type: "accommodation_room" | "transport" | "motorbike"
      catalogue_template: "accommodation" | "transport" | "motorbike"
      dependency_action:
        | "show"
        | "hide"
        | "require"
        | "enable"
        | "disable"
        | "set_value"
        | "set_minimum"
        | "set_maximum"
        | "reset_remove"
      field_type:
        | "single_select"
        | "multi_select"
        | "quantity"
        | "number"
        | "text"
        | "date"
        | "date_range"
        | "boolean"
        | "info_block"
      order_line_kind: "package" | "insurance"
      payment_request_kind: "first_payment" | "balance"
      payment_request_status:
        | "created"
        | "pending"
        | "paid"
        | "failed"
        | "expired"
        | "cancelled"
      payment_status:
        | "PAYMENT_PENDING"
        | "PARTIALLY_PAID"
        | "FULLY_PAID"
        | "PAYMENT_FAILED"
        | "PAYMENT_UNKNOWN"
      pricing_mode: "structured" | "formula"
      pricing_rule_type:
        | "fixed"
        | "variable_times_amount"
        | "component_quantity"
        | "conditional"
        | "tier"
      pricing_sign: "add" | "subtract"
      product_kind: "package" | "insurance"
      purchase_fulfillment_status: "not_started" | "in_progress" | "completed"
      purchase_status:
        | "pending_payment"
        | "partially_paid"
        | "paid"
        | "cancelled"
      season_period: "HIGH" | "MID" | "LOW"
      transport_type: "predefined_route" | "other_location"
      unit_basis:
        | "fixed"
        | "per_person"
        | "per_day"
        | "per_night"
        | "per_session"
      user_role: "ADMIN" | "STAFF"
      voucher_status:
        | "ACTIVE"
        | "USED"
        | "EXPIRED"
        | "CANCELLED"
        | "UNPAID"
        | "PAID"
      voucher_type: "STANDARD" | "GIFT"
      website_block_kind:
        | "hero"
        | "image_text"
        | "text"
        | "product_selection"
        | "video"
        | "people"
        | "door"
        | "catalogue"
      website_destination_kind:
        | "none"
        | "page"
        | "product"
        | "build_your_trip"
        | "book_individually"
        | "external"
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

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      accommodation_type: ["hotel", "beach_camping"],
      catalogue_source_type: ["accommodation_room", "transport", "motorbike"],
      catalogue_template: ["accommodation", "transport", "motorbike"],
      dependency_action: [
        "show",
        "hide",
        "require",
        "enable",
        "disable",
        "set_value",
        "set_minimum",
        "set_maximum",
        "reset_remove",
      ],
      field_type: [
        "single_select",
        "multi_select",
        "quantity",
        "number",
        "text",
        "date",
        "date_range",
        "boolean",
        "info_block",
      ],
      order_line_kind: ["package", "insurance"],
      payment_request_kind: ["first_payment", "balance"],
      payment_request_status: [
        "created",
        "pending",
        "paid",
        "failed",
        "expired",
        "cancelled",
      ],
      payment_status: [
        "PAYMENT_PENDING",
        "PARTIALLY_PAID",
        "FULLY_PAID",
        "PAYMENT_FAILED",
        "PAYMENT_UNKNOWN",
      ],
      pricing_mode: ["structured", "formula"],
      pricing_rule_type: [
        "fixed",
        "variable_times_amount",
        "component_quantity",
        "conditional",
        "tier",
      ],
      pricing_sign: ["add", "subtract"],
      product_kind: ["package", "insurance"],
      purchase_fulfillment_status: ["not_started", "in_progress", "completed"],
      purchase_status: [
        "pending_payment",
        "partially_paid",
        "paid",
        "cancelled",
      ],
      season_period: ["HIGH", "MID", "LOW"],
      transport_type: ["predefined_route", "other_location"],
      unit_basis: [
        "fixed",
        "per_person",
        "per_day",
        "per_night",
        "per_session",
      ],
      user_role: ["ADMIN", "STAFF"],
      voucher_status: [
        "ACTIVE",
        "USED",
        "EXPIRED",
        "CANCELLED",
        "UNPAID",
        "PAID",
      ],
      voucher_type: ["STANDARD", "GIFT"],
      website_block_kind: [
        "hero",
        "image_text",
        "text",
        "product_selection",
        "video",
        "people",
        "door",
        "catalogue",
      ],
      website_destination_kind: [
        "none",
        "page",
        "product",
        "build_your_trip",
        "book_individually",
        "external",
      ],
    },
  },
} as const
