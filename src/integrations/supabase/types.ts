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
      app_settings: {
        Row: {
          id: number
          rating_goal: number
          rating_justification_threshold: number
          sla_goal_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          rating_goal?: number
          rating_justification_threshold?: number
          sla_goal_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          rating_goal?: number
          rating_justification_threshold?: number
          sla_goal_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      approval_flow_approvers: {
        Row: {
          approver_id: string
          created_at: string
          flow_id: string
          id: string
        }
        Insert: {
          approver_id: string
          created_at?: string
          flow_id: string
          id?: string
        }
        Update: {
          approver_id?: string
          created_at?: string
          flow_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_flow_approvers_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_flows: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          name: string
          sector: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          name: string
          sector?: string | null
          service_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          sector?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_flows_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      attendant_return_reasons: {
        Row: {
          attendant_id: string
          can_close: boolean
          created_at: string
          id: string
          return_reason_id: string
          updated_at: string
        }
        Insert: {
          attendant_id: string
          can_close?: boolean
          created_at?: string
          id?: string
          return_reason_id: string
          updated_at?: string
        }
        Update: {
          attendant_id?: string
          can_close?: boolean
          created_at?: string
          id?: string
          return_reason_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_return_reasons_return_reason_id_fkey"
            columns: ["return_reason_id"]
            isOneToOne: false
            referencedRelation: "return_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      attendant_services: {
        Row: {
          attendant_id: string
          can_close: boolean
          id: string
          service_id: string
        }
        Insert: {
          attendant_id: string
          can_close?: boolean
          id?: string
          service_id: string
        }
        Update: {
          attendant_id?: string
          can_close?: boolean
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_financeiro: {
        Row: {
          created_at: string
          data_final: string
          data_inicial: string
          id: string
          situacao_financeira: string
        }
        Insert: {
          created_at?: string
          data_final: string
          data_inicial: string
          id?: string
          situacao_financeira?: string
        }
        Update: {
          created_at?: string
          data_final?: string
          data_inicial?: string
          id?: string
          situacao_financeira?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      financeiro: {
        Row: {
          ativo: string
          id: number
          mes_ano: string
        }
        Insert: {
          ativo?: string
          id?: number
          mes_ano: string
        }
        Update: {
          ativo?: string
          id?: number
          mes_ano?: string
        }
        Relationships: []
      }
      form_api_calls: {
        Row: {
          created_at: string
          error_message: string | null
          form_id: string | null
          id: string
          method: string
          request_payload: Json | null
          response_body: string | null
          response_status: number | null
          ticket_id: string | null
          url: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          form_id?: string | null
          id?: string
          method: string
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          ticket_id?: string | null
          url: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          form_id?: string | null
          id?: string
          method?: string
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          ticket_id?: string | null
          url?: string
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          api_param_name: string | null
          field_type: string
          form_id: string
          id: string
          label: string
          options: string[] | null
          required: boolean
          send_to_api: boolean
          sort_order: number
        }
        Insert: {
          api_param_name?: string | null
          field_type?: string
          form_id: string
          id?: string
          label: string
          options?: string[] | null
          required?: boolean
          send_to_api?: boolean
          sort_order?: number
        }
        Update: {
          api_param_name?: string | null
          field_type?: string
          form_id?: string
          id?: string
          label?: string
          options?: string[] | null
          required?: boolean
          send_to_api?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "service_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          can_change_return_reason: boolean
          can_close_tickets: boolean
          can_reopen_tickets: boolean
          can_transfer_tickets: boolean
          created_at: string
          email: string
          first_login: boolean
          function: string
          id: string
          leader_email: string
          leader_name: string
          name: string
          phone: string
          receives_new_tickets: boolean
          sector: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_change_return_reason?: boolean
          can_close_tickets?: boolean
          can_reopen_tickets?: boolean
          can_transfer_tickets?: boolean
          created_at?: string
          email: string
          first_login?: boolean
          function?: string
          id?: string
          leader_email?: string
          leader_name?: string
          name: string
          phone?: string
          receives_new_tickets?: boolean
          sector?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_change_return_reason?: boolean
          can_close_tickets?: boolean
          can_reopen_tickets?: boolean
          can_transfer_tickets?: boolean
          created_at?: string
          email?: string
          first_login?: boolean
          function?: string
          id?: string
          leader_email?: string
          leader_name?: string
          name?: string
          phone?: string
          receives_new_tickets?: boolean
          sector?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      return_reasons: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          sector: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          sector?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          sector?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_tickets: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          day_of_month: number | null
          days_of_week: number[] | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          run_date: string | null
          run_time: string
          service_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          day_of_month?: number | null
          days_of_week?: number[] | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          run_date?: string | null
          run_time?: string
          service_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          days_of_week?: number[] | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          run_date?: string | null
          run_time?: string
          service_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_forms: {
        Row: {
          api_enabled: boolean
          api_method: string
          api_timeout_seconds: number
          api_url: string | null
          api_values_in_path: boolean
          created_at: string
          id: string
          name: string
          service_id: string
        }
        Insert: {
          api_enabled?: boolean
          api_method?: string
          api_timeout_seconds?: number
          api_url?: string | null
          api_values_in_path?: boolean
          created_at?: string
          id?: string
          name: string
          service_id: string
        }
        Update: {
          api_enabled?: boolean
          api_method?: string
          api_timeout_seconds?: number
          api_url?: string | null
          api_values_in_path?: boolean
          created_at?: string
          id?: string
          name?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_forms_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          requires_description: boolean
          restricted_visibility: boolean
          sla_hours: number
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          requires_description?: boolean
          restricted_visibility?: boolean
          sla_hours: number
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          requires_description?: boolean
          restricted_visibility?: boolean
          sla_hours?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          record_id: string | null
          table_name: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_message_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_message_acknowledgments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "system_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      system_message_recipients: {
        Row: {
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "system_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      system_messages: {
        Row: {
          active: boolean
          content: string
          created_at: string
          created_by: string
          days_of_week: number[] | null
          end_time: string | null
          ends_at: string | null
          id: string
          schedule_type: Database["public"]["Enums"]["message_schedule_type"]
          start_time: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          created_by: string
          days_of_week?: number[] | null
          end_time?: string | null
          ends_at?: string | null
          id?: string
          schedule_type: Database["public"]["Enums"]["message_schedule_type"]
          start_time?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          created_by?: string
          days_of_week?: number[] | null
          end_time?: string | null
          ends_at?: string | null
          id?: string
          schedule_type?: Database["public"]["Enums"]["message_schedule_type"]
          start_time?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_approvals: {
        Row: {
          approver_id: string
          created_at: string
          decided_at: string | null
          flow_id: string | null
          id: string
          reason: string | null
          status: string
          ticket_id: string
        }
        Insert: {
          approver_id: string
          created_at?: string
          decided_at?: string | null
          flow_id?: string | null
          id?: string
          reason?: string | null
          status?: string
          ticket_id: string
        }
        Update: {
          approver_id?: string
          created_at?: string
          decided_at?: string | null
          flow_id?: string | null
          id?: string
          reason?: string | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_approvals_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_approvals_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_lifecycle_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_at: string
          event_type: string
          id: string
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_at?: string
          event_type: string
          id?: string
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_at?: string
          event_type?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_lifecycle_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_private: boolean
          sender_id: string | null
          sender_name: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_private?: boolean
          sender_id?: string | null
          sender_name: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_private?: boolean
          sender_id?: string | null
          sender_name?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_ratings: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          score: number
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          score: number
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          score?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_ratings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attendant_id: string
          closed_at: string | null
          closed_by: string | null
          code: number
          created_at: string
          created_by: string
          form_data: Json | null
          id: string
          priority: boolean
          reopened: boolean
          service_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendant_id: string
          closed_at?: string | null
          closed_by?: string | null
          code?: number
          created_at?: string
          created_by: string
          form_data?: Json | null
          id?: string
          priority?: boolean
          reopened?: boolean
          service_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendant_id?: string
          closed_at?: string | null
          closed_by?: string | null
          code?: number
          created_at?: string
          created_by?: string
          form_data?: Json | null
          id?: string
          priority?: boolean
          reopened?: boolean
          service_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
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
      work_schedules: {
        Row: {
          attendant_id: string
          day_of_week: number
          end_time: string
          id: string
          lunch_end: string
          lunch_start: string
          start_time: string
        }
        Insert: {
          attendant_id: string
          day_of_week: number
          end_time: string
          id?: string
          lunch_end?: string
          lunch_start?: string
          start_time: string
        }
        Update: {
          attendant_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          lunch_end?: string
          lunch_start?: string
          start_time?: string
        }
        Relationships: []
      }
    }
    Views: {
      attendant_list: {
        Row: {
          name: string | null
          user_id: string | null
        }
        Insert: {
          name?: string | null
          user_id?: string | null
        }
        Update: {
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calc_next_run: {
        Args: {
          _day_of_month: number
          _days_of_week: number[]
          _frequency: Database["public"]["Enums"]["schedule_frequency"]
          _from: string
          _run_date: string
          _run_time: string
        }
        Returns: string
      }
      can_attendant_close_return_reason: {
        Args: { _reason_description: string; _user_id: string }
        Returns: boolean
      }
      can_attendant_close_service: {
        Args: { _service_id: string; _user_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_active_attendants_for_service: {
        Args: { _service_id: string }
        Returns: {
          attendant_id: string
        }[]
      }
      get_active_attendants_with_name_for_service: {
        Args: { _service_id: string }
        Returns: {
          attendant_id: string
          name: string
        }[]
      }
      get_financeiro_pendencias: {
        Args: never
        Returns: {
          mes_ano: string
        }[]
      }
      get_flow_approver_names: { Args: { _flow_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ticket_approver: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      is_ticket_participant: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purge_old_system_logs: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      transfer_ticket: {
        Args: { _new_attendant_id: string; _ticket_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "attendant" | "tv"
      message_schedule_type: "on_login" | "period" | "recurring"
      schedule_frequency: "once" | "daily" | "weekly" | "monthly"
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
      app_role: ["admin", "user", "attendant", "tv"],
      message_schedule_type: ["on_login", "period", "recurring"],
      schedule_frequency: ["once", "daily", "weekly", "monthly"],
    },
  },
} as const
