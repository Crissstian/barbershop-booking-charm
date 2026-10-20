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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          amount_paid: number | null
          barber_id: string
          code: string
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          ends_at: string
          id: string
          notes: string | null
          occurrence_date: string | null
          payment_status: string
          recurring_id: string | null
          reminder_sent_at: string | null
          service_id: string
          staff_notes: string | null
          starts_at: string
          status: string
          token: string
          whatsapp_sent_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          barber_id: string
          code: string
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          ends_at: string
          id?: string
          notes?: string | null
          occurrence_date?: string | null
          payment_status?: string
          recurring_id?: string | null
          reminder_sent_at?: string | null
          service_id: string
          staff_notes?: string | null
          starts_at: string
          status?: string
          token?: string
          whatsapp_sent_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          barber_id?: string
          code?: string
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          ends_at?: string
          id?: string
          notes?: string | null
          occurrence_date?: string | null
          payment_status?: string
          recurring_id?: string | null
          reminder_sent_at?: string | null
          service_id?: string
          staff_notes?: string | null
          starts_at?: string
          status?: string
          token?: string
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_services: {
        Row: {
          barber_id: string
          created_at: string
          id: string
          service_id: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          id?: string
          service_id: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string | null
          id: string
          name: string
          photo_url: string | null
          role_title: string
          service_categories: string[]
          slug: string | null
          sort: number
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string | null
          id?: string
          name: string
          photo_url?: string | null
          role_title?: string
          service_categories?: string[]
          slug?: string | null
          sort?: number
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          role_title?: string
          service_categories?: string[]
          slug?: string | null
          sort?: number
        }
        Relationships: []
      }
      blocked_slots: {
        Row: {
          barber_id: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          barber_id: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          barber_id?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_slots_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_approvals: {
        Row: {
          created_at: string
          customer_id: string | null
          email: string
          first_name: string
          id: string
          invited_with: string | null
          last_name: string
          phone: string | null
          reviewed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          first_name: string
          id?: string
          invited_with?: string | null
          last_name: string
          phone?: string | null
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          first_name?: string
          id?: string
          invited_with?: string | null
          last_name?: string
          phone?: string | null
          reviewed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_approvals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_rewards: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          issued_at: string
          redeemed_at: string | null
          reward_key: string
          reward_type: string
          status: string
          threshold: number | null
          year: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          issued_at?: string
          redeemed_at?: string | null
          reward_key: string
          reward_type: string
          status?: string
          threshold?: number | null
          year?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          issued_at?: string
          redeemed_at?: string | null
          reward_key?: string
          reward_type?: string
          status?: string
          threshold?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_rewards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          birth_date: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string
          phone_normalized: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          birth_date?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string
          phone_normalized?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          birth_date?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          phone_normalized?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          brand: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      recurring_appointments: {
        Row: {
          active: boolean
          barber_id: string
          created_at: string
          customer_id: string
          end_date: string | null
          id: string
          interval_weeks: number
          notes: string | null
          service_id: string
          start_date: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          barber_id: string
          created_at?: string
          customer_id: string
          end_date?: string | null
          id?: string
          interval_weeks?: number
          notes?: string | null
          service_id: string
          start_date: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          barber_id?: string
          created_at?: string
          customer_id?: string
          end_date?: string | null
          id?: string
          interval_weeks?: number
          notes?: string | null
          service_id?: string
          start_date?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_exceptions: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          kind: string
          occurrence_date: string
          recurring_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          kind: string
          occurrence_date: string
          recurring_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          occurrence_date?: string
          recurring_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_exceptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_exceptions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string
          counts_as_haircut: boolean
          description: string | null
          duration_min: number
          id: string
          name: string
          price: number
          price_from: boolean
          sort: number
        }
        Insert: {
          active?: boolean
          category?: string
          counts_as_haircut?: boolean
          description?: string | null
          duration_min: number
          id?: string
          name: string
          price: number
          price_from?: boolean
          sort?: number
        }
        Update: {
          active?: boolean
          category?: string
          counts_as_haircut?: boolean
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price?: number
          price_from?: boolean
          sort?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          barber_id: string | null
          created_at: string
          day: string
          email: string
          id: string
          notified_at: string | null
          phone: string | null
          service_id: string | null
        }
        Insert: {
          barber_id?: string | null
          created_at?: string
          day: string
          email: string
          id?: string
          notified_at?: string | null
          phone?: string | null
          service_id?: string | null
        }
        Update: {
          barber_id?: string | null
          created_at?: string
          day?: string
          email?: string
          id?: string
          notified_at?: string | null
          phone?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          barber_id: string
          end_time: string
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          barber_id: string
          end_time: string
          id?: string
          start_time: string
          weekday: number
        }
        Update: {
          barber_id?: string
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
