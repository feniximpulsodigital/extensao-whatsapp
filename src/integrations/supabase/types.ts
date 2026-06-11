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
      ai_config: {
        Row: {
          auto_reply_enabled: boolean
          business_hours: Json
          created_at: string
          id: string
          max_tokens: number
          model: string
          provider: string
          response_delay_ms: number
          temperature: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auto_reply_enabled?: boolean
          business_hours?: Json
          created_at?: string
          id?: string
          max_tokens?: number
          model?: string
          provider?: string
          response_delay_ms?: number
          temperature?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auto_reply_enabled?: boolean
          business_hours?: Json
          created_at?: string
          id?: string
          max_tokens?: number
          model?: string
          provider?: string
          response_delay_ms?: number
          temperature?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_global_config: {
        Row: {
          created_at: string
          default_max_tokens: number
          default_model: string
          default_monthly_usd: number
          default_temperature: number
          enabled: boolean
          id: string
          master_system_prompt: string
          provider: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_max_tokens?: number
          default_model?: string
          default_monthly_usd?: number
          default_temperature?: number
          enabled?: boolean
          id?: string
          master_system_prompt?: string
          provider?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_max_tokens?: number
          default_model?: string
          default_monthly_usd?: number
          default_temperature?: number
          enabled?: boolean
          id?: string
          master_system_prompt?: string
          provider?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_pricing_config: {
        Row: {
          created_at: string
          credits_per_usd: number
          global_markup_multiplier: number
          id: string
          model_cost_overrides: Json
          singleton: boolean
          updated_at: string
          usd_to_brl: number
        }
        Insert: {
          created_at?: string
          credits_per_usd?: number
          global_markup_multiplier?: number
          id?: string
          model_cost_overrides?: Json
          singleton?: boolean
          updated_at?: string
          usd_to_brl?: number
        }
        Update: {
          created_at?: string
          credits_per_usd?: number
          global_markup_multiplier?: number
          id?: string
          model_cost_overrides?: Json
          singleton?: boolean
          updated_at?: string
          usd_to_brl?: number
        }
        Relationships: []
      }
      ai_reply_claims: {
        Row: {
          claim_key: string
          claimed_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          claim_key: string
          claimed_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          claim_key?: string
          claimed_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reply_claims_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          cost_usd_real: number
          created_at: string
          credits_charged: number
          endpoint: string | null
          id: string
          input_tokens: number
          metadata: Json
          model: string
          output_tokens: number
          tenant_id: string
        }
        Insert: {
          cost_usd_real?: number
          created_at?: string
          credits_charged?: number
          endpoint?: string | null
          id?: string
          input_tokens?: number
          metadata?: Json
          model: string
          output_tokens?: number
          tenant_id: string
        }
        Update: {
          cost_usd_real?: number
          created_at?: string
          credits_charged?: number
          endpoint?: string | null
          id?: string
          input_tokens?: number
          metadata?: Json
          model?: string
          output_tokens?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          asaas_api_key_production: string | null
          asaas_api_key_sandbox: string | null
          asaas_env: string
          asaas_webhook_token: string | null
          brand_accent_dark: string
          brand_accent_light: string
          brand_logo_url: string | null
          brand_name: string
          created_at: string
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          asaas_api_key_production?: string | null
          asaas_api_key_sandbox?: string | null
          asaas_env?: string
          asaas_webhook_token?: string | null
          brand_accent_dark?: string
          brand_accent_light?: string
          brand_logo_url?: string | null
          brand_name?: string
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          asaas_api_key_production?: string | null
          asaas_api_key_sandbox?: string | null
          asaas_env?: string
          asaas_webhook_token?: string | null
          brand_accent_dark?: string
          brand_accent_light?: string
          brand_logo_url?: string | null
          brand_name?: string
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      brand_config: {
        Row: {
          brand_name: string
          created_at: string
          icon_url: string | null
          id: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand_name?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invites: {
        Row: {
          accepted_at: string | null
          amount_cents: number
          billing_cycle: string
          company_name: string | null
          created_at: string
          custom_allowance: number | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          phone: string | null
          plan_id: string | null
          status: string
          tenant_id: string
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount_cents?: number
          billing_cycle?: string
          company_name?: string | null
          created_at?: string
          custom_allowance?: number | null
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          plan_id?: string | null
          status?: string
          tenant_id: string
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount_cents?: number
          billing_cycle?: string
          company_name?: string | null
          created_at?: string
          custom_allowance?: number | null
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          plan_id?: string | null
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invites_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          bonus_credits: number
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean
          markup_multiplier: number | null
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          credits: number
          description?: string | null
          id?: string
          is_active?: boolean
          markup_multiplier?: number | null
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          markup_multiplier?: number | null
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_files: {
        Row: {
          char_count: number
          content: string
          created_at: string
          filename: string
          id: string
          is_active: boolean
          tenant_id: string
        }
        Insert: {
          char_count?: number
          content: string
          created_at?: string
          filename: string
          id?: string
          is_active?: boolean
          tenant_id: string
        }
        Update: {
          char_count?: number
          content?: string
          created_at?: string
          filename?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          asaas_payment_id: string | null
          billing_cycle: string | null
          billing_type: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          invite_id: string | null
          invoice_url: string | null
          kind: string
          metadata: Json
          package_id: string | null
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          asaas_payment_id?: string | null
          billing_cycle?: string | null
          billing_type?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invite_id?: string | null
          invoice_url?: string | null
          kind?: string
          metadata?: Json
          package_id?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          asaas_payment_id?: string | null
          billing_cycle?: string | null
          billing_type?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invite_id?: string | null
          invoice_url?: string | null
          kind?: string
          metadata?: Json
          package_id?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "client_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          asaas_plan_ref: string | null
          billing_cycle: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_custom: boolean
          low_balance_threshold_pct: number
          max_knowledge_entries: number
          monthly_credits: number
          name: string
          price_cents: number
          price_cents_annual: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          asaas_plan_ref?: string | null
          billing_cycle?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_custom?: boolean
          low_balance_threshold_pct?: number
          max_knowledge_entries?: number
          monthly_credits?: number
          name: string
          price_cents?: number
          price_cents_annual?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          asaas_plan_ref?: string | null
          billing_cycle?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_custom?: boolean
          low_balance_threshold_pct?: number
          max_knowledge_entries?: number
          monthly_credits?: number
          name?: string
          price_cents?: number
          price_cents_annual?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_prompts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string | null
          company_name: string
          created_at: string
          created_by_admin: boolean
          credits_balance: number
          credits_monthly_allowance: number
          credits_rollover: boolean
          custom_plan_expires_at: string | null
          document: string | null
          extension_api_key: string
          id: string
          last_credits_renewed_at: string | null
          notes: string | null
          owner_id: string
          plan_id: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          subscription_renews_at: string | null
          subscription_started_at: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          company_name: string
          created_at?: string
          created_by_admin?: boolean
          credits_balance?: number
          credits_monthly_allowance?: number
          credits_rollover?: boolean
          custom_plan_expires_at?: string | null
          document?: string | null
          extension_api_key?: string
          id?: string
          last_credits_renewed_at?: string | null
          notes?: string | null
          owner_id: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          subscription_renews_at?: string | null
          subscription_started_at?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          company_name?: string
          created_at?: string
          created_by_admin?: boolean
          credits_balance?: number
          credits_monthly_allowance?: number
          credits_rollover?: boolean
          custom_plan_expires_at?: string | null
          document?: string | null
          extension_api_key?: string
          id?: string
          last_credits_renewed_at?: string | null
          notes?: string | null
          owner_id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          subscription_renews_at?: string | null
          subscription_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
      payment_status:
        | "pending"
        | "confirmed"
        | "received"
        | "overdue"
        | "refunded"
        | "failed"
      tenant_status:
        | "active"
        | "suspended"
        | "cancelled"
        | "trial"
        | "pending_payment"
      transaction_type:
        | "purchase"
        | "consumption"
        | "bonus"
        | "refund"
        | "adjustment"
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
      app_role: ["admin", "client"],
      payment_status: [
        "pending",
        "confirmed",
        "received",
        "overdue",
        "refunded",
        "failed",
      ],
      tenant_status: [
        "active",
        "suspended",
        "cancelled",
        "trial",
        "pending_payment",
      ],
      transaction_type: [
        "purchase",
        "consumption",
        "bonus",
        "refund",
        "adjustment",
      ],
    },
  },
} as const
