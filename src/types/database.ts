
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "applicants": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"email": string | null,"full_name": string,"id": string,"notes": string | null,"phone": string | null,"status": Database["public"]['Enums']["applicant_status"],"status_changed_at": string,"updated_at": string,"user_id": string | null,"vacancy_id": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"status"?: Database["public"]['Enums']["applicant_status"],"status_changed_at"?: string,"updated_at"?: string,"user_id"?: string | null,"vacancy_id": string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"status"?: Database["public"]['Enums']["applicant_status"],"status_changed_at"?: string,"updated_at"?: string,"user_id"?: string | null,"vacancy_id"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "applicants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applicants_vacancy_id_fkey"
      columns: ["vacancy_id"]
isOneToOne: false
      referencedRelation: "vacancies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applicants_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "applicants_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": Database["public"]['Enums']["audit_action"],"changed_at": string,"changed_by": string | null,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["audit_action"],"changed_at"?: string,"changed_by"?: string | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["audit_action"],"changed_at"?: string,"changed_by"?: string | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"brigade_slots": {
                  Row: {
                    "aisle": number,"brigade_type_id": string,"code": string,"created_at": string,"deleted_at": string | null,"id": string,"level": number,"notes": string | null,"position": number,"rack": number,"status": Database["public"]['Enums']["slot_status"],"updated_at": string,"warehouse_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle": number,"brigade_type_id": string,"code": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"level": number,"notes"?: string | null,"position": number,"rack": number,"status"?: Database["public"]['Enums']["slot_status"],"updated_at"?: string,"warehouse_id": string,"zone_id": string
                  }
                  Update: {
                    "aisle"?: number,"brigade_type_id"?: string,"code"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"level"?: number,"notes"?: string | null,"position"?: number,"rack"?: number,"status"?: Database["public"]['Enums']["slot_status"],"updated_at"?: string,"warehouse_id"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brigade_slots_brigade_type_id_fkey"
      columns: ["brigade_type_id"]
isOneToOne: false
      referencedRelation: "brigade_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brigade_slots_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "brigade_slots_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brigade_slots_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "brigade_slots_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"brigade_types": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string | null,"height_m": number,"id": string,"is_active": boolean,"is_default": boolean,"length_m": number,"max_weight_kg": number,"name": string,"updated_at": string,"volume_m3": number | null,"width_m": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"height_m": number,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"length_m": number,"max_weight_kg": number,"name": string,"updated_at"?: string,"volume_m3"?: never,"width_m": number
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"height_m"?: number,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"length_m"?: number,"max_weight_kg"?: number,"name"?: string,"updated_at"?: string,"volume_m3"?: never,"width_m"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"email": string,"full_name": string,"id": string,"is_active": boolean,"must_change_password": boolean,"phone": string | null,"preferred_language": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email": string,"full_name"?: string,"id": string,"is_active"?: boolean,"must_change_password"?: boolean,"phone"?: string | null,"preferred_language"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"must_change_password"?: boolean,"phone"?: string | null,"preferred_language"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "profiles_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"vacancies": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string | null,"id": string,"openings": number,"role_to_hire": Database["public"]['Enums']["app_role"],"status": Database["public"]['Enums']["vacancy_status"],"title": string,"updated_at": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"openings"?: number,"role_to_hire"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["vacancy_status"],"title": string,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"openings"?: number,"role_to_hire"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["vacancy_status"],"title"?: string,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vacancies_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "vacancies_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"warehouse_managers": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"updated_at": string,"user_id": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"updated_at"?: string,"user_id": string,"warehouse_id": string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"updated_at"?: string,"user_id"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "warehouse_managers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warehouse_managers_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "warehouse_managers_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"warehouses": {
                  Row: {
                    "address_line1": string | null,"address_line2": string | null,"city": string | null,"closes_at": string | null,"code": string,"contact_email": string | null,"contact_name": string | null,"contact_phone": string | null,"created_at": string,"deleted_at": string | null,"district": string | null,"id": string,"is_24x7": boolean,"is_active": boolean,"latitude": number | null,"longitude": number | null,"name": string,"opens_at": string | null,"operating_notes": string | null,"pincode": string | null,"state": string,"total_area_sqft": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"city"?: string | null,"closes_at"?: string | null,"code"?: string,"contact_email"?: string | null,"contact_name"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"district"?: string | null,"id"?: string,"is_24x7"?: boolean,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name": string,"opens_at"?: string | null,"operating_notes"?: string | null,"pincode"?: string | null,"state"?: string,"total_area_sqft"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"city"?: string | null,"closes_at"?: string | null,"code"?: string,"contact_email"?: string | null,"contact_name"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"district"?: string | null,"id"?: string,"is_24x7"?: boolean,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"opens_at"?: string | null,"operating_notes"?: string | null,"pincode"?: string | null,"state"?: string,"total_area_sqft"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"zones": {
                  Row: {
                    "code": string,"created_at": string,"deleted_at": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number | null,"temp_min": number | null,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max"?: number | null,"temp_min"?: number | null,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"storage_type"?: Database["public"]['Enums']["storage_type"],"temp_max"?: number | null,"temp_min"?: number | null,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "zones_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "zones_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_zone_slot_summary": {
                  Row: {
                    "blocked_slots": number | null,"free_slots": number | null,"occupied_slots": number | null,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number | null,"temp_min": number | null,"total_slots": number | null,"warehouse_code": string,"warehouse_id": string,"warehouse_name": string,"zone_code": string,"zone_id": string,"zone_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "can_read_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"can_write_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"create_brigade_slots":
{ Args: { "p_aisle_start"?: number,"p_aisles": number,"p_brigade_type_id": string,"p_levels": number,"p_racks": number,"p_slots_per_level"?: number,"p_zone_id": string }; Returns: number
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff_of":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"manages_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "SUPER_ADMIN"|"WAREHOUSE_MANAGER"|"STAFF"|"CLIENT","applicant_status": "APPLIED"|"INTERVIEW"|"OFFERED"|"JOINED"|"REJECTED","audit_action": "INSERT"|"UPDATE"|"DELETE","slot_status": "FREE"|"OCCUPIED"|"BLOCKED","storage_type": "DRY"|"CHILLED"|"FROZEN"|"DEEP_FREEZE"|"BONDED"|"HAZMAT","vacancy_status": "OPEN"|"ON_HOLD"|"CLOSED"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["SUPER_ADMIN", "WAREHOUSE_MANAGER", "STAFF", "CLIENT"],"applicant_status": ["APPLIED", "INTERVIEW", "OFFERED", "JOINED", "REJECTED"],"audit_action": ["INSERT", "UPDATE", "DELETE"],"slot_status": ["FREE", "OCCUPIED", "BLOCKED"],"storage_type": ["DRY", "CHILLED", "FROZEN", "DEEP_FREEZE", "BONDED", "HAZMAT"],"vacancy_status": ["OPEN", "ON_HOLD", "CLOSED"]
          }
        }
} as const
