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
          product_id: string
          step_id: string
          updated_at: string
          variable_name: string
        }
        Insert: {
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
          product_id: string
          step_id: string
          updated_at?: string
          variable_name: string
        }
        Update: {
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
          product_id?: string
          step_id?: string
          updated_at?: string
          variable_name?: string
        }
        Relationships: [
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
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      duplicate_product: { Args: { _source: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: never; Returns: boolean }
    }
    Enums: {
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
      unit_basis:
        | "fixed"
        | "per_person"
        | "per_day"
        | "per_night"
        | "per_session"
      user_role: "ADMIN" | "STAFF"
      voucher_status: "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED"
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
      unit_basis: [
        "fixed",
        "per_person",
        "per_day",
        "per_night",
        "per_session",
      ],
      user_role: ["ADMIN", "STAFF"],
      voucher_status: ["ACTIVE", "USED", "EXPIRED", "CANCELLED"],
    },
  },
} as const
