
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "adjustment_note_lines": {
                  Row: {
                    "cgst_paise": number,"description": string,"exempt": boolean,"exempt_reason": string | null,"gst_rate_bp": number,"id": string,"igst_paise": number,"note_id": string,"sac_code": string | null,"section": Database["public"]['Enums']["invoice_section"],"sgst_paise": number,"taxable_paise": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cgst_paise"?: number,"description": string,"exempt"?: boolean,"exempt_reason"?: string | null,"gst_rate_bp": number,"id"?: string,"igst_paise"?: number,"note_id": string,"sac_code"?: string | null,"section": Database["public"]['Enums']["invoice_section"],"sgst_paise"?: number,"taxable_paise": number
                  }
                  Update: {
                    "cgst_paise"?: number,"description"?: string,"exempt"?: boolean,"exempt_reason"?: string | null,"gst_rate_bp"?: number,"id"?: string,"igst_paise"?: number,"note_id"?: string,"sac_code"?: string | null,"section"?: Database["public"]['Enums']["invoice_section"],"sgst_paise"?: number,"taxable_paise"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "adjustment_note_lines_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "adjustment_notes"
      referencedColumns: ["id"]
    }
                  ]
                },"adjustment_notes": {
                  Row: {
                    "cgst_paise": number,"client_id": string,"created_at": string,"created_by": string | null,"grand_total_paise": number,"id": string,"igst_paise": number,"invoice_id": string,"kind": Database["public"]['Enums']["note_kind"],"note_date": string,"note_no": string,"paid_paise": number,"place_of_supply": string | null,"reason": string,"round_off_paise": number,"sgst_paise": number,"supply_kind": string,"tax_paise": number,"taxable_paise": number,"total_before_round_paise": number,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cgst_paise"?: number,"client_id": string,"created_at"?: string,"created_by"?: string | null,"grand_total_paise": number,"id"?: string,"igst_paise"?: number,"invoice_id": string,"kind": Database["public"]['Enums']["note_kind"],"note_date": string,"note_no": string,"paid_paise"?: number,"place_of_supply"?: string | null,"reason": string,"round_off_paise": number,"sgst_paise"?: number,"supply_kind": string,"tax_paise": number,"taxable_paise": number,"total_before_round_paise": number,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "cgst_paise"?: number,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"grand_total_paise"?: number,"id"?: string,"igst_paise"?: number,"invoice_id"?: string,"kind"?: Database["public"]['Enums']["note_kind"],"note_date"?: string,"note_no"?: string,"paid_paise"?: number,"place_of_supply"?: string | null,"reason"?: string,"round_off_paise"?: number,"sgst_paise"?: number,"supply_kind"?: string,"tax_paise"?: number,"taxable_paise"?: number,"total_before_round_paise"?: number,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "adjustment_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adjustment_notes_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adjustment_notes_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "adjustment_notes_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "adjustment_notes_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_evidence": {
                  Row: {
                    "alert_id": string,"raw_value": number,"recorded_at": string,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id": string,"raw_value": number,"recorded_at": string,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  Update: {
                    "alert_id"?: string,"raw_value"?: number,"recorded_at"?: string,"sensor_id"?: string,"source"?: Database["public"]['Enums']["reading_source"],"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_evidence_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_evidence_sensor_id_fkey"
      columns: ["sensor_id"]
isOneToOne: false
      referencedRelation: "sensors"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_rules": {
                  Row: {
                    "battery_low_pct": number | null,"calibration_warn_days": number | null,"created_at": string,"critical_ack_min": number | null,"critical_after_min": number | null,"critical_deviation_deg": number | null,"delay_min": number | null,"door_open_after_min": number | null,"enabled": boolean,"humidity_delay_min": number | null,"humidity_max": number | null,"humidity_min": number | null,"max_temp": number | null,"min_temp": number | null,"offline_after_min": number | null,"recovery_min": number | null,"tolerance_deg": number | null,"updated_at": string,"warehouse_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "battery_low_pct"?: number | null,"calibration_warn_days"?: number | null,"created_at"?: string,"critical_ack_min"?: number | null,"critical_after_min"?: number | null,"critical_deviation_deg"?: number | null,"delay_min"?: number | null,"door_open_after_min"?: number | null,"enabled"?: boolean,"humidity_delay_min"?: number | null,"humidity_max"?: number | null,"humidity_min"?: number | null,"max_temp"?: number | null,"min_temp"?: number | null,"offline_after_min"?: number | null,"recovery_min"?: number | null,"tolerance_deg"?: number | null,"updated_at"?: string,"warehouse_id": string,"zone_id": string
                  }
                  Update: {
                    "battery_low_pct"?: number | null,"calibration_warn_days"?: number | null,"created_at"?: string,"critical_ack_min"?: number | null,"critical_after_min"?: number | null,"critical_deviation_deg"?: number | null,"delay_min"?: number | null,"door_open_after_min"?: number | null,"enabled"?: boolean,"humidity_delay_min"?: number | null,"humidity_max"?: number | null,"humidity_min"?: number | null,"max_temp"?: number | null,"min_temp"?: number | null,"offline_after_min"?: number | null,"recovery_min"?: number | null,"tolerance_deg"?: number | null,"updated_at"?: string,"warehouse_id"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_rules_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "alert_rules_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "alert_rules_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_rules_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: true
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "alert_rules_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: true
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_stock": {
                  Row: {
                    "alert_id": string,"batch_no": string | null,"client_id": string,"client_name": string,"expiry_date": string | null,"id": string,"item_name": string | null,"quantity": number | null,"slot_code": string | null,"slot_id": string | null,"stock_item_id": string | null,"unit": string | null,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id": string,"batch_no"?: string | null,"client_id": string,"client_name": string,"expiry_date"?: string | null,"id"?: string,"item_name"?: string | null,"quantity"?: number | null,"slot_code"?: string | null,"slot_id"?: string | null,"stock_item_id"?: string | null,"unit"?: string | null,"zone_id": string
                  }
                  Update: {
                    "alert_id"?: string,"batch_no"?: string | null,"client_id"?: string,"client_name"?: string,"expiry_date"?: string | null,"id"?: string,"item_name"?: string | null,"quantity"?: number | null,"slot_code"?: string | null,"slot_id"?: string | null,"stock_item_id"?: string | null,"unit"?: string | null,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_stock_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_stock_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_stock_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "alert_stock_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"alerts": {
                  Row: {
                    "acknowledged_at": string | null,"acknowledged_by": string | null,"action_taken": string | null,"cause": string | null,"created_at": string,"details": Json | null,"duration_min": number,"equipment_id": string | null,"escalated_at": string | null,"escalation_level": number,"event_start": string,"id": string,"kind": Database["public"]['Enums']["alert_kind"],"limit_value": number | null,"maintenance_task_id": string | null,"opened_at": string,"peak_deviation": number,"peak_value": number | null,"recovered_at": string | null,"resolved_at": string | null,"resolved_by": string | null,"sensor_id": string | null,"severity": Database["public"]['Enums']["alert_severity"],"status": Database["public"]['Enums']["alert_status"],"updated_at": string,"warehouse_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"action_taken"?: string | null,"cause"?: string | null,"created_at"?: string,"details"?: Json | null,"duration_min"?: number,"equipment_id"?: string | null,"escalated_at"?: string | null,"escalation_level"?: number,"event_start": string,"id"?: string,"kind": Database["public"]['Enums']["alert_kind"],"limit_value"?: number | null,"maintenance_task_id"?: string | null,"opened_at": string,"peak_deviation"?: number,"peak_value"?: number | null,"recovered_at"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"sensor_id"?: string | null,"severity": Database["public"]['Enums']["alert_severity"],"status"?: Database["public"]['Enums']["alert_status"],"updated_at"?: string,"warehouse_id": string,"zone_id": string
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"action_taken"?: string | null,"cause"?: string | null,"created_at"?: string,"details"?: Json | null,"duration_min"?: number,"equipment_id"?: string | null,"escalated_at"?: string | null,"escalation_level"?: number,"event_start"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"limit_value"?: number | null,"maintenance_task_id"?: string | null,"opened_at"?: string,"peak_deviation"?: number,"peak_value"?: number | null,"recovered_at"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"sensor_id"?: string | null,"severity"?: Database["public"]['Enums']["alert_severity"],"status"?: Database["public"]['Enums']["alert_status"],"updated_at"?: string,"warehouse_id"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_maintenance_task_id_fkey"
      columns: ["maintenance_task_id"]
isOneToOne: false
      referencedRelation: "maintenance_tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_sensor_id_fkey"
      columns: ["sensor_id"]
isOneToOne: false
      referencedRelation: "sensors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "alerts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "alerts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "alerts_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"applicants": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"email": string | null,"expected_joining": string | null,"full_name": string,"id": string,"notes": string | null,"offer_issued_at": string | null,"offer_letter_path": string | null,"phone": string | null,"resume_path": string | null,"source": string | null,"status": Database["public"]['Enums']["applicant_status"],"status_changed_at": string,"updated_at": string,"user_id": string | null,"vacancy_id": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"expected_joining"?: string | null,"full_name": string,"id"?: string,"notes"?: string | null,"offer_issued_at"?: string | null,"offer_letter_path"?: string | null,"phone"?: string | null,"resume_path"?: string | null,"source"?: string | null,"status"?: Database["public"]['Enums']["applicant_status"],"status_changed_at"?: string,"updated_at"?: string,"user_id"?: string | null,"vacancy_id": string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"expected_joining"?: string | null,"full_name"?: string,"id"?: string,"notes"?: string | null,"offer_issued_at"?: string | null,"offer_letter_path"?: string | null,"phone"?: string | null,"resume_path"?: string | null,"source"?: string | null,"status"?: Database["public"]['Enums']["applicant_status"],"status_changed_at"?: string,"updated_at"?: string,"user_id"?: string | null,"vacancy_id"?: string,"warehouse_id"?: string | null
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
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "applicants_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "check_in_at": string | null,"check_in_distance_m": number | null,"check_in_lat": number | null,"check_in_lon": number | null,"check_out_at": string | null,"check_out_lat": number | null,"check_out_lon": number | null,"correction_in": string | null,"correction_out": string | null,"correction_reason": string | null,"correction_status": Database["public"]['Enums']["correction_status"],"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"gps_ok": boolean | null,"id": string,"updated_at": string,"user_id": string,"warehouse_id": string,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "check_in_at"?: string | null,"check_in_distance_m"?: number | null,"check_in_lat"?: number | null,"check_in_lon"?: number | null,"check_out_at"?: string | null,"check_out_lat"?: number | null,"check_out_lon"?: number | null,"correction_in"?: string | null,"correction_out"?: string | null,"correction_reason"?: string | null,"correction_status"?: Database["public"]['Enums']["correction_status"],"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"gps_ok"?: boolean | null,"id"?: string,"updated_at"?: string,"user_id": string,"warehouse_id": string,"work_date": string
                  }
                  Update: {
                    "check_in_at"?: string | null,"check_in_distance_m"?: number | null,"check_in_lat"?: number | null,"check_in_lon"?: number | null,"check_out_at"?: string | null,"check_out_lat"?: number | null,"check_out_lon"?: number | null,"correction_in"?: string | null,"correction_out"?: string | null,"correction_reason"?: string | null,"correction_status"?: Database["public"]['Enums']["correction_status"],"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"gps_ok"?: boolean | null,"id"?: string,"updated_at"?: string,"user_id"?: string,"warehouse_id"?: string,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "attendance_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "attendance_warehouse_id_fkey"
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
                },"billing_job_log": {
                  Row: {
                    "client_id": string | null,"created_at": string,"id": number,"job": string,"message": string | null,"ok": boolean,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"id"?: never,"job": string,"message"?: string | null,"ok": boolean,"warehouse_id"?: string | null
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"id"?: never,"job"?: string,"message"?: string | null,"ok"?: boolean,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"brigade_slots": {
                  Row: {
                    "aisle": number,"booking_id": string | null,"brigade_type_id": string,"code": string,"created_at": string,"deleted_at": string | null,"id": string,"level": number,"notes": string | null,"position": number,"rack": number,"reserved_client_id": string | null,"status": Database["public"]['Enums']["slot_status"],"updated_at": string,"warehouse_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle": number,"booking_id"?: string | null,"brigade_type_id": string,"code": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"level": number,"notes"?: string | null,"position": number,"rack": number,"reserved_client_id"?: string | null,"status"?: Database["public"]['Enums']["slot_status"],"updated_at"?: string,"warehouse_id": string,"zone_id": string
                  }
                  Update: {
                    "aisle"?: number,"booking_id"?: string | null,"brigade_type_id"?: string,"code"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"level"?: number,"notes"?: string | null,"position"?: number,"rack"?: number,"reserved_client_id"?: string | null,"status"?: Database["public"]['Enums']["slot_status"],"updated_at"?: string,"warehouse_id"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brigade_slots_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "space_bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brigade_slots_brigade_type_id_fkey"
      columns: ["brigade_type_id"]
isOneToOne: false
      referencedRelation: "brigade_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brigade_slots_reserved_client_id_fkey"
      columns: ["reserved_client_id"]
isOneToOne: false
      referencedRelation: "clients"
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
      referencedRelation: "warehouse_manager_counts"
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
                },"calibration_log": {
                  Row: {
                    "calibrated_on": string,"certificate_path": string | null,"created_at": string,"done_by": string | null,"id": string,"notes": string | null,"offset_applied": number,"reference_value": number,"sensor_id": string,"sensor_value": number,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calibrated_on": string,"certificate_path"?: string | null,"created_at"?: string,"done_by"?: string | null,"id"?: string,"notes"?: string | null,"offset_applied": number,"reference_value": number,"sensor_id": string,"sensor_value": number,"warehouse_id": string
                  }
                  Update: {
                    "calibrated_on"?: string,"certificate_path"?: string | null,"created_at"?: string,"done_by"?: string | null,"id"?: string,"notes"?: string | null,"offset_applied"?: number,"reference_value"?: number,"sensor_id"?: string,"sensor_value"?: number,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calibration_log_sensor_id_fkey"
      columns: ["sensor_id"]
isOneToOne: false
      referencedRelation: "sensors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calibration_log_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "calibration_log_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "calibration_log_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"client_change_requests": {
                  Row: {
                    "changes": NonNullable<Json>,"client_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"requested_by": string | null,"status": Database["public"]['Enums']["request_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changes": NonNullable<Json>,"client_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"client_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_change_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"client_contacts": {
                  Row: {
                    "client_id": string,"created_at": string,"deleted_at": string | null,"email": string | null,"id": string,"name": string,"notify_alerts": boolean,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"name": string,"notify_alerts"?: boolean,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"name"?: string,"notify_alerts"?: boolean,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_contacts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"client_groups": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"client_notices": {
                  Row: {
                    "alert_id": string,"approved_at": string | null,"approved_by": string | null,"body": string,"client_id": string,"created_at": string,"id": string,"status": string,"subject": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id": string,"approved_at"?: string | null,"approved_by"?: string | null,"body": string,"client_id": string,"created_at"?: string,"id"?: string,"status"?: string,"subject": string,"warehouse_id": string
                  }
                  Update: {
                    "alert_id"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"body"?: string,"client_id"?: string,"created_at"?: string,"id"?: string,"status"?: string,"subject"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_notices_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "client_notices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "client_notices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "address_line1": string | null,"address_line2": string | null,"billing_cycle": Database["public"]['Enums']["billing_cycle"],"billing_mode": Database["public"]['Enums']["billing_mode"],"billing_override_reason": string | null,"billing_override_until": string | null,"city": string | null,"code": string,"company_name": string,"contact_name": string | null,"created_at": string,"credit_limit_paise": number,"deleted_at": string | null,"district": string | null,"email": string | null,"group_id": string | null,"gst_exempt": boolean,"gst_exempt_reason": string | null,"gstin": string | null,"id": string,"notes": string | null,"pan": string | null,"payment_terms_days": number,"phone": string | null,"pick_rule": Database["public"]['Enums']["pick_rule"],"pincode": string | null,"state": string | null,"state_code": string | null,"status": Database["public"]['Enums']["client_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"billing_mode"?: Database["public"]['Enums']["billing_mode"],"billing_override_reason"?: string | null,"billing_override_until"?: string | null,"city"?: string | null,"code"?: string,"company_name": string,"contact_name"?: string | null,"created_at"?: string,"credit_limit_paise"?: number,"deleted_at"?: string | null,"district"?: string | null,"email"?: string | null,"group_id"?: string | null,"gst_exempt"?: boolean,"gst_exempt_reason"?: string | null,"gstin"?: string | null,"id"?: string,"notes"?: string | null,"pan"?: string | null,"payment_terms_days"?: number,"phone"?: string | null,"pick_rule"?: Database["public"]['Enums']["pick_rule"],"pincode"?: string | null,"state"?: string | null,"state_code"?: string | null,"status"?: Database["public"]['Enums']["client_status"],"updated_at"?: string
                  }
                  Update: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"billing_mode"?: Database["public"]['Enums']["billing_mode"],"billing_override_reason"?: string | null,"billing_override_until"?: string | null,"city"?: string | null,"code"?: string,"company_name"?: string,"contact_name"?: string | null,"created_at"?: string,"credit_limit_paise"?: number,"deleted_at"?: string | null,"district"?: string | null,"email"?: string | null,"group_id"?: string | null,"gst_exempt"?: boolean,"gst_exempt_reason"?: string | null,"gstin"?: string | null,"id"?: string,"notes"?: string | null,"pan"?: string | null,"payment_terms_days"?: number,"phone"?: string | null,"pick_rule"?: Database["public"]['Enums']["pick_rule"],"pincode"?: string | null,"state"?: string | null,"state_code"?: string | null,"status"?: Database["public"]['Enums']["client_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "client_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_state_code_fkey"
      columns: ["state_code"]
isOneToOne: false
      referencedRelation: "gst_states"
      referencedColumns: ["code"]
    }
                  ]
                },"company_master": {
                  Row: {
                    "address_line1": string | null,"address_line2": string | null,"city": string | null,"client_id": string,"contact_name": string | null,"created_at": string,"deleted_at": string | null,"district": string | null,"email": string | null,"gstin": string | null,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["company_kind"],"name": string,"pan": string | null,"phone": string | null,"pincode": string | null,"state": string | null,"state_code": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"city"?: string | null,"client_id": string,"contact_name"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"district"?: string | null,"email"?: string | null,"gstin"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["company_kind"],"name": string,"pan"?: string | null,"phone"?: string | null,"pincode"?: string | null,"state"?: string | null,"state_code"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"city"?: string | null,"client_id"?: string,"contact_name"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"district"?: string | null,"email"?: string | null,"gstin"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["company_kind"],"name"?: string,"pan"?: string | null,"phone"?: string | null,"pincode"?: string | null,"state"?: string | null,"state_code"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_master_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_master_state_code_fkey"
      columns: ["state_code"]
isOneToOne: false
      referencedRelation: "gst_states"
      referencedColumns: ["code"]
    }
                  ]
                },"contracts": {
                  Row: {
                    "client_id": string,"committed_brigades": number,"contract_no": string | null,"created_at": string,"deleted_at": string | null,"end_date": string | null,"id": string,"min_days": number,"notes": string | null,"notice_period_days": number,"rate_card_id": string | null,"security_deposit_paise": number,"start_date": string,"status": Database["public"]['Enums']["contract_status"],"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"committed_brigades"?: number,"contract_no"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"end_date"?: string | null,"id"?: string,"min_days"?: number,"notes"?: string | null,"notice_period_days"?: number,"rate_card_id"?: string | null,"security_deposit_paise"?: number,"start_date": string,"status"?: Database["public"]['Enums']["contract_status"],"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "client_id"?: string,"committed_brigades"?: number,"contract_no"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"end_date"?: string | null,"id"?: string,"min_days"?: number,"notes"?: string | null,"notice_period_days"?: number,"rate_card_id"?: string | null,"security_deposit_paise"?: number,"start_date"?: string,"status"?: Database["public"]['Enums']["contract_status"],"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "contracts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "contracts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"crew_log": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document_id": string,"document_type": string,"id": string,"user_id": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document_id": string,"document_type": string,"id"?: string,"user_id": string,"warehouse_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string,"document_type"?: string,"id"?: string,"user_id"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_log_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "crew_log_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "crew_log_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"cron_job_runs": {
                  Row: {
                    "duration_ms": number | null,"error": string | null,"finished_at": string | null,"id": number,"job": string,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: never,"job": string,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "duration_ms"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: never,"job"?: string,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cron_job_state": {
                  Row: {
                    "failures": number,"job": string,"last_error": string | null,"last_ok_at": string | null,"last_started_at": string | null,"last_status": string | null,"max_age_minutes": number,"runs": number
                  }
                  ComputedFields: never
                  Insert: {
                    "failures"?: number,"job": string,"last_error"?: string | null,"last_ok_at"?: string | null,"last_started_at"?: string | null,"last_status"?: string | null,"max_age_minutes"?: number,"runs"?: number
                  }
                  Update: {
                    "failures"?: number,"job"?: string,"last_error"?: string | null,"last_ok_at"?: string | null,"last_started_at"?: string | null,"last_status"?: string | null,"max_age_minutes"?: number,"runs"?: number
                  }
                  Relationships: [
                    
                  ]
                },"daily_occupancy": {
                  Row: {
                    "brigade_type_id": string,"brigades": number,"client_id": string,"created_at": string,"free_brigades": number,"id": string,"occ_date": string,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number | null,"temp_min": number | null,"volume_m3": number,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brigade_type_id": string,"brigades": number,"client_id": string,"created_at"?: string,"free_brigades"?: number,"id"?: string,"occ_date": string,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max"?: number | null,"temp_min"?: number | null,"volume_m3"?: number,"warehouse_id": string
                  }
                  Update: {
                    "brigade_type_id"?: string,"brigades"?: number,"client_id"?: string,"created_at"?: string,"free_brigades"?: number,"id"?: string,"occ_date"?: string,"storage_type"?: Database["public"]['Enums']["storage_type"],"temp_max"?: number | null,"temp_min"?: number | null,"volume_m3"?: number,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_occupancy_brigade_type_id_fkey"
      columns: ["brigade_type_id"]
isOneToOne: false
      referencedRelation: "brigade_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_occupancy_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_occupancy_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "daily_occupancy_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "daily_occupancy_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"defrost_windows": {
                  Row: {
                    "created_at": string,"days": (number)[] | null,"end_time": string,"id": string,"is_active": boolean,"name": string,"start_time": string,"updated_at": string,"warehouse_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"days"?: (number)[] | null,"end_time": string,"id"?: string,"is_active"?: boolean,"name"?: string,"start_time": string,"updated_at"?: string,"warehouse_id": string,"zone_id": string
                  }
                  Update: {
                    "created_at"?: string,"days"?: (number)[] | null,"end_time"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"start_time"?: string,"updated_at"?: string,"warehouse_id"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "defrost_windows_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "defrost_windows_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "defrost_windows_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "defrost_windows_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "defrost_windows_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_challan_lines": {
                  Row: {
                    "batch_no": string | null,"challan_id": string,"client_id": string,"created_at": string,"expiry_date": string | null,"id": string,"item_name": string,"line_no": number,"mfg_date": string | null,"packages": number,"pick_id": string | null,"quantity": number,"sku": string | null,"slot_code": string,"slot_id": string,"stock_item_id": string,"unit": string,"updated_at": string,"warehouse_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_no"?: string | null,"challan_id": string,"client_id": string,"created_at"?: string,"expiry_date"?: string | null,"id"?: string,"item_name": string,"line_no": number,"mfg_date"?: string | null,"packages"?: number,"pick_id"?: string | null,"quantity": number,"sku"?: string | null,"slot_code": string,"slot_id": string,"stock_item_id": string,"unit": string,"updated_at"?: string,"warehouse_id": string,"weight_kg"?: number
                  }
                  Update: {
                    "batch_no"?: string | null,"challan_id"?: string,"client_id"?: string,"created_at"?: string,"expiry_date"?: string | null,"id"?: string,"item_name"?: string,"line_no"?: number,"mfg_date"?: string | null,"packages"?: number,"pick_id"?: string | null,"quantity"?: number,"sku"?: string | null,"slot_code"?: string,"slot_id"?: string,"stock_item_id"?: string,"unit"?: string,"updated_at"?: string,"warehouse_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_challan_lines_challan_id_fkey"
      columns: ["challan_id"]
isOneToOne: false
      referencedRelation: "delivery_challans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challan_lines_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challan_lines_pick_id_fkey"
      columns: ["pick_id"]
isOneToOne: false
      referencedRelation: "dispatch_picks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challan_lines_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "brigade_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challan_lines_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challan_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "delivery_challan_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "delivery_challan_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_challans": {
                  Row: {
                    "billed_invoice_id": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"challan_no": string,"client_id": string,"confirmed_by": string | null,"created_at": string,"deleted_at": string | null,"dispatch_request_id": string,"dispatch_temp_c": number | null,"dispatched_at": string,"gate_entry_id": string,"id": string,"pod_signed_at": string | null,"receiver_name": string | null,"remarks": string | null,"seal_number": string | null,"signature_path": string | null,"status": Database["public"]['Enums']["document_status"],"to_company_id": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billed_invoice_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"challan_no": string,"client_id": string,"confirmed_by"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"dispatch_request_id": string,"dispatch_temp_c"?: number | null,"dispatched_at"?: string,"gate_entry_id": string,"id"?: string,"pod_signed_at"?: string | null,"receiver_name"?: string | null,"remarks"?: string | null,"seal_number"?: string | null,"signature_path"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"to_company_id": string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "billed_invoice_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"challan_no"?: string,"client_id"?: string,"confirmed_by"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"dispatch_request_id"?: string,"dispatch_temp_c"?: number | null,"dispatched_at"?: string,"gate_entry_id"?: string,"id"?: string,"pod_signed_at"?: string | null,"receiver_name"?: string | null,"remarks"?: string | null,"seal_number"?: string | null,"signature_path"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"to_company_id"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_challans_billed_fk"
      columns: ["billed_invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challans_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challans_dispatch_request_id_fkey"
      columns: ["dispatch_request_id"]
isOneToOne: true
      referencedRelation: "dispatch_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challans_gate_entry_id_fkey"
      columns: ["gate_entry_id"]
isOneToOne: true
      referencedRelation: "gate_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challans_to_company_id_fkey"
      columns: ["to_company_id"]
isOneToOne: false
      referencedRelation: "company_master"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_challans_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "delivery_challans_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "delivery_challans_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"device_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"key_hash": string,"key_prefix": string,"label": string,"last_used_at": string | null,"revoked_at": string | null,"sensor_id": string | null,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key_hash": string,"key_prefix": string,"label": string,"last_used_at"?: string | null,"revoked_at"?: string | null,"sensor_id"?: string | null,"warehouse_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key_hash"?: string,"key_prefix"?: string,"label"?: string,"last_used_at"?: string | null,"revoked_at"?: string | null,"sensor_id"?: string | null,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_keys_sensor_id_fkey"
      columns: ["sensor_id"]
isOneToOne: false
      referencedRelation: "sensors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "device_keys_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "device_keys_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "device_keys_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"dispatch_picks": {
                  Row: {
                    "batch_no": string | null,"client_id": string,"created_at": string,"expiry_date": string | null,"id": string,"item_name": string,"pick_seq": number,"picked": boolean,"picked_at": string | null,"picked_by": string | null,"quantity": number,"request_id": string,"request_line_id": string,"sku": string | null,"slot_code": string,"slot_id": string,"stock_item_id": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_no"?: string | null,"client_id": string,"created_at"?: string,"expiry_date"?: string | null,"id"?: string,"item_name": string,"pick_seq": number,"picked"?: boolean,"picked_at"?: string | null,"picked_by"?: string | null,"quantity": number,"request_id": string,"request_line_id": string,"sku"?: string | null,"slot_code": string,"slot_id": string,"stock_item_id": string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "batch_no"?: string | null,"client_id"?: string,"created_at"?: string,"expiry_date"?: string | null,"id"?: string,"item_name"?: string,"pick_seq"?: number,"picked"?: boolean,"picked_at"?: string | null,"picked_by"?: string | null,"quantity"?: number,"request_id"?: string,"request_line_id"?: string,"sku"?: string | null,"slot_code"?: string,"slot_id"?: string,"stock_item_id"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispatch_picks_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_picks_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "dispatch_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_picks_request_line_id_fkey"
      columns: ["request_line_id"]
isOneToOne: false
      referencedRelation: "dispatch_request_lines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_picks_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "brigade_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_picks_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_picks_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "dispatch_picks_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "dispatch_picks_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"dispatch_request_lines": {
                  Row: {
                    "batch_no": string | null,"client_id": string,"created_at": string,"deleted_at": string | null,"id": string,"item_name": string,"line_no": number,"quantity": number,"request_id": string,"sku": string | null,"unit": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_no"?: string | null,"client_id": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"item_name": string,"line_no": number,"quantity": number,"request_id": string,"sku"?: string | null,"unit"?: string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "batch_no"?: string | null,"client_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"item_name"?: string,"line_no"?: number,"quantity"?: number,"request_id"?: string,"sku"?: string | null,"unit"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispatch_request_lines_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_request_lines_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "dispatch_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_request_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "dispatch_request_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "dispatch_request_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"dispatch_requests": {
                  Row: {
                    "client_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"deleted_at": string | null,"id": string,"remarks": string | null,"request_no": string | null,"requested_by": string | null,"requested_date": string,"status": Database["public"]['Enums']["dispatch_status"],"to_company_id": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"deleted_at"?: string | null,"id"?: string,"remarks"?: string | null,"request_no"?: string | null,"requested_by"?: string | null,"requested_date": string,"status"?: Database["public"]['Enums']["dispatch_status"],"to_company_id": string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"deleted_at"?: string | null,"id"?: string,"remarks"?: string | null,"request_no"?: string | null,"requested_by"?: string | null,"requested_date"?: string,"status"?: Database["public"]['Enums']["dispatch_status"],"to_company_id"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispatch_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_requests_to_company_id_fkey"
      columns: ["to_company_id"]
isOneToOne: false
      referencedRelation: "company_master"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_requests_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "dispatch_requests_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "dispatch_requests_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"doc_counters": {
                  Row: {
                    "doc_type": string,"fin_year": string,"last_no": number,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "doc_type": string,"fin_year": string,"last_no"?: number,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "doc_type"?: string,"fin_year"?: string,"last_no"?: number,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "doc_counters_doc_type_fkey"
      columns: ["doc_type"]
isOneToOne: false
      referencedRelation: "doc_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "doc_counters_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "doc_counters_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "doc_counters_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"doc_types": {
                  Row: {
                    "code": string,"name": string,"prefix": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"name": string,"prefix": string
                  }
                  Update: {
                    "code"?: string,"name"?: string,"prefix"?: string
                  }
                  Relationships: [
                    
                  ]
                },"employee_private": {
                  Row: {
                    "bank_account_holder": string | null,"bank_account_no": string | null,"bank_ifsc": string | null,"bank_name": string | null,"employee_id": string,"id_proof_path": string | null,"id_proof_type": string | null,"updated_at": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_account_holder"?: string | null,"bank_account_no"?: string | null,"bank_ifsc"?: string | null,"bank_name"?: string | null,"employee_id": string,"id_proof_path"?: string | null,"id_proof_type"?: string | null,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "bank_account_holder"?: string | null,"bank_account_no"?: string | null,"bank_ifsc"?: string | null,"bank_name"?: string | null,"employee_id"?: string,"id_proof_path"?: string | null,"id_proof_type"?: string | null,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employee_private_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: true
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"employees": {
                  Row: {
                    "applicant_id": string | null,"code": string,"created_at": string,"deleted_at": string | null,"emergency_contact_name": string | null,"emergency_contact_phone": string | null,"exit_date": string | null,"id": string,"job_role": Database["public"]['Enums']["job_role"],"joining_date": string,"status": Database["public"]['Enums']["employee_status"],"updated_at": string,"user_id": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_id"?: string | null,"code"?: string,"created_at"?: string,"deleted_at"?: string | null,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"exit_date"?: string | null,"id"?: string,"job_role"?: Database["public"]['Enums']["job_role"],"joining_date"?: string,"status"?: Database["public"]['Enums']["employee_status"],"updated_at"?: string,"user_id": string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "applicant_id"?: string | null,"code"?: string,"created_at"?: string,"deleted_at"?: string | null,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"exit_date"?: string | null,"id"?: string,"job_role"?: Database["public"]['Enums']["job_role"],"joining_date"?: string,"status"?: Database["public"]['Enums']["employee_status"],"updated_at"?: string,"user_id"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employees_applicant_id_fkey"
      columns: ["applicant_id"]
isOneToOne: false
      referencedRelation: "applicants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employees_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employees_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "employees_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "employees_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"equipment": {
                  Row: {
                    "code": string | null,"created_at": string,"deleted_at": string | null,"id": string,"last_service_on": string | null,"name": string,"next_service_due": string | null,"notes": string | null,"service_interval_days": number | null,"status": string,"type": Database["public"]['Enums']["equipment_type"],"updated_at": string,"vendor": string | null,"vendor_phone": string | null,"warehouse_id": string,"warranty_end": string | null,"zone_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"last_service_on"?: string | null,"name": string,"next_service_due"?: string | null,"notes"?: string | null,"service_interval_days"?: number | null,"status"?: string,"type"?: Database["public"]['Enums']["equipment_type"],"updated_at"?: string,"vendor"?: string | null,"vendor_phone"?: string | null,"warehouse_id": string,"warranty_end"?: string | null,"zone_id"?: string | null
                  }
                  Update: {
                    "code"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"last_service_on"?: string | null,"name"?: string,"next_service_due"?: string | null,"notes"?: string | null,"service_interval_days"?: number | null,"status"?: string,"type"?: Database["public"]['Enums']["equipment_type"],"updated_at"?: string,"vendor"?: string | null,"vendor_phone"?: string | null,"warehouse_id"?: string,"warranty_end"?: string | null,"zone_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "equipment_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "equipment_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "equipment_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"gate_entries": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"capacity_tonnes": number | null,"client_id": string,"company_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"direction": Database["public"]['Enums']["gate_direction"],"dispatch_request_id": string | null,"driver_licence_no": string | null,"driver_name": string | null,"driver_phone": string | null,"eway_bill_number": string | null,"eway_valid_until": string | null,"gate_in_at": string,"gate_out_at": string | null,"gate_pass_no": string | null,"id": string,"invoice_number": string | null,"loading_end_at": string | null,"loading_start_at": string | null,"lorry_number": string,"lorry_temp_c": number | null,"lorry_type": string | null,"lr_number": string | null,"photos": (string)[],"remarks": string | null,"seal_number_arrival": string | null,"seal_number_departure": string | null,"status": Database["public"]['Enums']["gate_status"],"transporter_name": string | null,"unloading_end_at": string | null,"unloading_start_at": string | null,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"capacity_tonnes"?: number | null,"client_id": string,"company_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"direction": Database["public"]['Enums']["gate_direction"],"dispatch_request_id"?: string | null,"driver_licence_no"?: string | null,"driver_name"?: string | null,"driver_phone"?: string | null,"eway_bill_number"?: string | null,"eway_valid_until"?: string | null,"gate_in_at"?: string,"gate_out_at"?: string | null,"gate_pass_no"?: string | null,"id"?: string,"invoice_number"?: string | null,"loading_end_at"?: string | null,"loading_start_at"?: string | null,"lorry_number": string,"lorry_temp_c"?: number | null,"lorry_type"?: string | null,"lr_number"?: string | null,"photos"?: (string)[],"remarks"?: string | null,"seal_number_arrival"?: string | null,"seal_number_departure"?: string | null,"status"?: Database["public"]['Enums']["gate_status"],"transporter_name"?: string | null,"unloading_end_at"?: string | null,"unloading_start_at"?: string | null,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"capacity_tonnes"?: number | null,"client_id"?: string,"company_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"direction"?: Database["public"]['Enums']["gate_direction"],"dispatch_request_id"?: string | null,"driver_licence_no"?: string | null,"driver_name"?: string | null,"driver_phone"?: string | null,"eway_bill_number"?: string | null,"eway_valid_until"?: string | null,"gate_in_at"?: string,"gate_out_at"?: string | null,"gate_pass_no"?: string | null,"id"?: string,"invoice_number"?: string | null,"loading_end_at"?: string | null,"loading_start_at"?: string | null,"lorry_number"?: string,"lorry_temp_c"?: number | null,"lorry_type"?: string | null,"lr_number"?: string | null,"photos"?: (string)[],"remarks"?: string | null,"seal_number_arrival"?: string | null,"seal_number_departure"?: string | null,"status"?: Database["public"]['Enums']["gate_status"],"transporter_name"?: string | null,"unloading_end_at"?: string | null,"unloading_start_at"?: string | null,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gate_entries_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gate_entries_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "company_master"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gate_entries_dispatch_request_fk"
      columns: ["dispatch_request_id"]
isOneToOne: false
      referencedRelation: "dispatch_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gate_entries_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "gate_entries_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "gate_entries_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"gate_entry_lines": {
                  Row: {
                    "accepted_qty": number | null,"batch_no": string | null,"client_id": string,"condition": Database["public"]['Enums']["line_condition"] | null,"counted_qty": number | null,"created_at": string,"damaged_qty": number,"declared_qty": number,"deleted_at": string | null,"expiry_date": string | null,"gate_entry_id": string,"id": string,"item_name": string,"line_no": number,"mfg_date": string | null,"packages": number,"photo_path": string | null,"remarks": string | null,"required_temp_c": number | null,"short_qty": number,"sku": string | null,"storage_type": Database["public"]['Enums']["storage_type"] | null,"unit": string,"updated_at": string,"warehouse_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_qty"?: number | null,"batch_no"?: string | null,"client_id": string,"condition"?: Database["public"]['Enums']["line_condition"] | null,"counted_qty"?: number | null,"created_at"?: string,"damaged_qty"?: number,"declared_qty": number,"deleted_at"?: string | null,"expiry_date"?: string | null,"gate_entry_id": string,"id"?: string,"item_name": string,"line_no": number,"mfg_date"?: string | null,"packages"?: number,"photo_path"?: string | null,"remarks"?: string | null,"required_temp_c"?: number | null,"short_qty"?: number,"sku"?: string | null,"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"unit"?: string,"updated_at"?: string,"warehouse_id": string,"weight_kg"?: number
                  }
                  Update: {
                    "accepted_qty"?: number | null,"batch_no"?: string | null,"client_id"?: string,"condition"?: Database["public"]['Enums']["line_condition"] | null,"counted_qty"?: number | null,"created_at"?: string,"damaged_qty"?: number,"declared_qty"?: number,"deleted_at"?: string | null,"expiry_date"?: string | null,"gate_entry_id"?: string,"id"?: string,"item_name"?: string,"line_no"?: number,"mfg_date"?: string | null,"packages"?: number,"photo_path"?: string | null,"remarks"?: string | null,"required_temp_c"?: number | null,"short_qty"?: number,"sku"?: string | null,"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"unit"?: string,"updated_at"?: string,"warehouse_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "gate_entry_lines_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gate_entry_lines_gate_entry_id_fkey"
      columns: ["gate_entry_id"]
isOneToOne: false
      referencedRelation: "gate_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gate_entry_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "gate_entry_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "gate_entry_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"gst_states": {
                  Row: {
                    "code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"name": string
                  }
                  Update: {
                    "code"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"internal_secrets": {
                  Row: {
                    "key": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"value": string
                  }
                  Update: {
                    "key"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"interview_rounds": {
                  Row: {
                    "applicant_id": string,"created_at": string,"id": string,"interviewer": string,"notes": string | null,"round_no": number,"scheduled_at": string,"score": number | null,"updated_at": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_id": string,"created_at"?: string,"id"?: string,"interviewer": string,"notes"?: string | null,"round_no": number,"scheduled_at": string,"score"?: number | null,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "applicant_id"?: string,"created_at"?: string,"id"?: string,"interviewer"?: string,"notes"?: string | null,"round_no"?: number,"scheduled_at"?: string,"score"?: number | null,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "interview_rounds_applicant_id_fkey"
      columns: ["applicant_id"]
isOneToOne: false
      referencedRelation: "applicants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interview_rounds_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "interview_rounds_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "interview_rounds_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_lines": {
                  Row: {
                    "allocation_ids": (string)[],"amount_paise": number,"calc_detail": Json | null,"charge_id": string | null,"created_at": string,"description": string,"discount_paise": number,"doc_id": string | null,"doc_no": string | null,"doc_type": string | null,"exempt": boolean,"exempt_reason": string | null,"fix_reason": string | null,"fixed_at": string | null,"fixed_by": string | null,"from_date": string | null,"gst_rate_bp": number,"id": string,"invoice_id": string,"line_no": number,"lorry_number": string | null,"manual": boolean,"original_amount_paise": number | null,"percent_base": string | null,"percent_bp": number | null,"quantity": number,"rate_ids": (string)[],"rate_paise": number,"rate_source": string | null,"sac_code": string | null,"section": Database["public"]['Enums']["invoice_section"],"storage_type": Database["public"]['Enums']["storage_type"] | null,"taxable_paise": number,"temp_max": number | null,"temp_min": number | null,"to_date": string | null,"unit": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation_ids"?: (string)[],"amount_paise"?: number,"calc_detail"?: Json | null,"charge_id"?: string | null,"created_at"?: string,"description": string,"discount_paise"?: number,"doc_id"?: string | null,"doc_no"?: string | null,"doc_type"?: string | null,"exempt"?: boolean,"exempt_reason"?: string | null,"fix_reason"?: string | null,"fixed_at"?: string | null,"fixed_by"?: string | null,"from_date"?: string | null,"gst_rate_bp"?: number,"id"?: string,"invoice_id": string,"line_no": number,"lorry_number"?: string | null,"manual"?: boolean,"original_amount_paise"?: number | null,"percent_base"?: string | null,"percent_bp"?: number | null,"quantity"?: number,"rate_ids"?: (string)[],"rate_paise"?: number,"rate_source"?: string | null,"sac_code"?: string | null,"section": Database["public"]['Enums']["invoice_section"],"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"taxable_paise"?: number,"temp_max"?: number | null,"temp_min"?: number | null,"to_date"?: string | null,"unit"?: string,"updated_at"?: string
                  }
                  Update: {
                    "allocation_ids"?: (string)[],"amount_paise"?: number,"calc_detail"?: Json | null,"charge_id"?: string | null,"created_at"?: string,"description"?: string,"discount_paise"?: number,"doc_id"?: string | null,"doc_no"?: string | null,"doc_type"?: string | null,"exempt"?: boolean,"exempt_reason"?: string | null,"fix_reason"?: string | null,"fixed_at"?: string | null,"fixed_by"?: string | null,"from_date"?: string | null,"gst_rate_bp"?: number,"id"?: string,"invoice_id"?: string,"line_no"?: number,"lorry_number"?: string | null,"manual"?: boolean,"original_amount_paise"?: number | null,"percent_base"?: string | null,"percent_bp"?: number | null,"quantity"?: number,"rate_ids"?: (string)[],"rate_paise"?: number,"rate_source"?: string | null,"sac_code"?: string | null,"section"?: Database["public"]['Enums']["invoice_section"],"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"taxable_paise"?: number,"temp_max"?: number | null,"temp_min"?: number | null,"to_date"?: string | null,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_lines_charge_id_fkey"
      columns: ["charge_id"]
isOneToOne: false
      referencedRelation: "other_charges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_lines_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_tax_lines": {
                  Row: {
                    "cgst_paise": number,"exempt": boolean,"exempt_reason": string | null,"gst_rate_bp": number,"id": string,"igst_paise": number,"invoice_id": string,"sac_code": string | null,"section": Database["public"]['Enums']["invoice_section"],"sgst_paise": number,"taxable_paise": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cgst_paise"?: number,"exempt"?: boolean,"exempt_reason"?: string | null,"gst_rate_bp": number,"id"?: string,"igst_paise"?: number,"invoice_id": string,"sac_code"?: string | null,"section": Database["public"]['Enums']["invoice_section"],"sgst_paise"?: number,"taxable_paise": number
                  }
                  Update: {
                    "cgst_paise"?: number,"exempt"?: boolean,"exempt_reason"?: string | null,"gst_rate_bp"?: number,"id"?: string,"igst_paise"?: number,"invoice_id"?: string,"sac_code"?: string | null,"section"?: Database["public"]['Enums']["invoice_section"],"sgst_paise"?: number,"taxable_paise"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_tax_lines_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "ack_date": string | null,"ack_no": string | null,"billing_mode": Database["public"]['Enums']["billing_mode"],"cancel_reason": string | null,"cgst_paise": number,"client_id": string,"client_snapshot": Json | null,"created_at": string,"credit_paise": number,"due_date": string | null,"emailed_at": string | null,"generated_by": string | null,"grand_total_paise": number,"id": string,"igst_paise": number,"invoice_date": string | null,"invoice_no": string | null,"irn": string | null,"issued_at": string | null,"issued_by": string | null,"labour_taxable_paise": number,"other_taxable_paise": number,"paid_paise": number,"pdf_path": string | null,"period_from": string,"period_to": string,"place_of_supply": string | null,"qr_code": string | null,"rent_range": unknown,"rent_taxable_paise": number,"round_off_paise": number,"sgst_paise": number,"status": Database["public"]['Enums']["invoice_status"],"supplier_snapshot": Json | null,"supply_kind": string,"tax_paise": number,"taxable_paise": number,"total_before_round_paise": number,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ack_date"?: string | null,"ack_no"?: string | null,"billing_mode": Database["public"]['Enums']["billing_mode"],"cancel_reason"?: string | null,"cgst_paise"?: number,"client_id": string,"client_snapshot"?: Json | null,"created_at"?: string,"credit_paise"?: number,"due_date"?: string | null,"emailed_at"?: string | null,"generated_by"?: string | null,"grand_total_paise"?: number,"id"?: string,"igst_paise"?: number,"invoice_date"?: string | null,"invoice_no"?: string | null,"irn"?: string | null,"issued_at"?: string | null,"issued_by"?: string | null,"labour_taxable_paise"?: number,"other_taxable_paise"?: number,"paid_paise"?: number,"pdf_path"?: string | null,"period_from": string,"period_to": string,"place_of_supply"?: string | null,"qr_code"?: string | null,"rent_range"?: unknown,"rent_taxable_paise"?: number,"round_off_paise"?: number,"sgst_paise"?: number,"status"?: Database["public"]['Enums']["invoice_status"],"supplier_snapshot"?: Json | null,"supply_kind"?: string,"tax_paise"?: number,"taxable_paise"?: number,"total_before_round_paise"?: number,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "ack_date"?: string | null,"ack_no"?: string | null,"billing_mode"?: Database["public"]['Enums']["billing_mode"],"cancel_reason"?: string | null,"cgst_paise"?: number,"client_id"?: string,"client_snapshot"?: Json | null,"created_at"?: string,"credit_paise"?: number,"due_date"?: string | null,"emailed_at"?: string | null,"generated_by"?: string | null,"grand_total_paise"?: number,"id"?: string,"igst_paise"?: number,"invoice_date"?: string | null,"invoice_no"?: string | null,"irn"?: string | null,"issued_at"?: string | null,"issued_by"?: string | null,"labour_taxable_paise"?: number,"other_taxable_paise"?: number,"paid_paise"?: number,"pdf_path"?: string | null,"period_from"?: string,"period_to"?: string,"place_of_supply"?: string | null,"qr_code"?: string | null,"rent_range"?: unknown,"rent_taxable_paise"?: number,"round_off_paise"?: number,"sgst_paise"?: number,"status"?: Database["public"]['Enums']["invoice_status"],"supplier_snapshot"?: Json | null,"supply_kind"?: string,"tax_paise"?: number,"taxable_paise"?: number,"total_before_round_paise"?: number,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "invoices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "invoices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"inward_advice_lines": {
                  Row: {
                    "advice_id": string,"batch_no": string | null,"expiry_date": string | null,"id": string,"item_name": string,"line_no": number,"packages": number,"quantity": number,"required_temp_c": number | null,"sku": string | null,"storage_type": Database["public"]['Enums']["storage_type"] | null,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advice_id": string,"batch_no"?: string | null,"expiry_date"?: string | null,"id"?: string,"item_name": string,"line_no": number,"packages"?: number,"quantity": number,"required_temp_c"?: number | null,"sku"?: string | null,"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"unit"?: string
                  }
                  Update: {
                    "advice_id"?: string,"batch_no"?: string | null,"expiry_date"?: string | null,"id"?: string,"item_name"?: string,"line_no"?: number,"packages"?: number,"quantity"?: number,"required_temp_c"?: number | null,"sku"?: string | null,"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inward_advice_lines_advice_id_fkey"
      columns: ["advice_id"]
isOneToOne: false
      referencedRelation: "inward_advices"
      referencedColumns: ["id"]
    }
                  ]
                },"inward_advices": {
                  Row: {
                    "advice_no": string,"client_id": string,"company_id": string | null,"created_at": string,"created_by": string | null,"driver_name": string | null,"driver_phone": string | null,"expected_date": string,"gate_entry_id": string | null,"id": string,"lorry_number": string | null,"remarks": string | null,"status": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advice_no"?: string,"client_id": string,"company_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"driver_name"?: string | null,"driver_phone"?: string | null,"expected_date": string,"gate_entry_id"?: string | null,"id"?: string,"lorry_number"?: string | null,"remarks"?: string | null,"status"?: string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "advice_no"?: string,"client_id"?: string,"company_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"driver_name"?: string | null,"driver_phone"?: string | null,"expected_date"?: string,"gate_entry_id"?: string | null,"id"?: string,"lorry_number"?: string | null,"remarks"?: string | null,"status"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inward_advices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_advices_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "company_master"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_advices_gate_entry_id_fkey"
      columns: ["gate_entry_id"]
isOneToOne: false
      referencedRelation: "gate_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_advices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inward_advices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inward_advices_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"inward_receipt_lines": {
                  Row: {
                    "accepted_qty": number,"batch_no": string | null,"client_id": string,"condition": Database["public"]['Enums']["line_condition"],"created_at": string,"damaged_qty": number,"declared_qty": number,"deleted_at": string | null,"expiry_date": string | null,"gate_entry_line_id": string,"id": string,"item_name": string,"line_no": number,"mfg_date": string | null,"packages": number,"receipt_id": string,"remarks": string | null,"required_temp_c": number | null,"short_qty": number,"sku": string | null,"slot_codes": (string)[],"storage_type": Database["public"]['Enums']["storage_type"] | null,"unit": string,"updated_at": string,"warehouse_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_qty"?: number,"batch_no"?: string | null,"client_id": string,"condition": Database["public"]['Enums']["line_condition"],"created_at"?: string,"damaged_qty"?: number,"declared_qty": number,"deleted_at"?: string | null,"expiry_date"?: string | null,"gate_entry_line_id": string,"id"?: string,"item_name": string,"line_no": number,"mfg_date"?: string | null,"packages"?: number,"receipt_id": string,"remarks"?: string | null,"required_temp_c"?: number | null,"short_qty"?: number,"sku"?: string | null,"slot_codes"?: (string)[],"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"unit": string,"updated_at"?: string,"warehouse_id": string,"weight_kg"?: number
                  }
                  Update: {
                    "accepted_qty"?: number,"batch_no"?: string | null,"client_id"?: string,"condition"?: Database["public"]['Enums']["line_condition"],"created_at"?: string,"damaged_qty"?: number,"declared_qty"?: number,"deleted_at"?: string | null,"expiry_date"?: string | null,"gate_entry_line_id"?: string,"id"?: string,"item_name"?: string,"line_no"?: number,"mfg_date"?: string | null,"packages"?: number,"receipt_id"?: string,"remarks"?: string | null,"required_temp_c"?: number | null,"short_qty"?: number,"sku"?: string | null,"slot_codes"?: (string)[],"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"unit"?: string,"updated_at"?: string,"warehouse_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inward_receipt_lines_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_receipt_lines_gate_entry_line_id_fkey"
      columns: ["gate_entry_line_id"]
isOneToOne: false
      referencedRelation: "gate_entry_lines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_receipt_lines_receipt_id_fkey"
      columns: ["receipt_id"]
isOneToOne: false
      referencedRelation: "inward_receipts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_receipt_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inward_receipt_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inward_receipt_lines_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"inward_receipts": {
                  Row: {
                    "billed_invoice_id": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"client_id": string,"company_id": string | null,"confirmed_by": string | null,"created_at": string,"deleted_at": string | null,"gate_entry_id": string,"id": string,"receipt_no": string,"received_at": string,"remarks": string | null,"status": Database["public"]['Enums']["document_status"],"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billed_invoice_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id": string,"company_id"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"gate_entry_id": string,"id"?: string,"receipt_no": string,"received_at"?: string,"remarks"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "billed_invoice_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id"?: string,"company_id"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"gate_entry_id"?: string,"id"?: string,"receipt_no"?: string,"received_at"?: string,"remarks"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inward_receipts_billed_fk"
      columns: ["billed_invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_receipts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_receipts_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "company_master"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_receipts_gate_entry_id_fkey"
      columns: ["gate_entry_id"]
isOneToOne: true
      referencedRelation: "gate_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inward_receipts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inward_receipts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inward_receipts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"labour_entries": {
                  Row: {
                    "activity": Database["public"]['Enums']["labour_activity"],"cancelled": boolean,"client_id": string,"created_at": string,"created_by": string | null,"document_id": string,"document_type": string,"hours": number,"id": string,"is_night": boolean,"is_overtime": boolean,"packages": number,"remarks": string | null,"tonnes": number,"updated_at": string,"warehouse_id": string,"workers": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": Database["public"]['Enums']["labour_activity"],"cancelled"?: boolean,"client_id": string,"created_at"?: string,"created_by"?: string | null,"document_id": string,"document_type": string,"hours": number,"id"?: string,"is_night"?: boolean,"is_overtime"?: boolean,"packages"?: number,"remarks"?: string | null,"tonnes"?: number,"updated_at"?: string,"warehouse_id": string,"workers": number
                  }
                  Update: {
                    "activity"?: Database["public"]['Enums']["labour_activity"],"cancelled"?: boolean,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"document_id"?: string,"document_type"?: string,"hours"?: number,"id"?: string,"is_night"?: boolean,"is_overtime"?: boolean,"packages"?: number,"remarks"?: string | null,"tonnes"?: number,"updated_at"?: string,"warehouse_id"?: string,"workers"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "labour_entries_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "labour_entries_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "labour_entries_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "labour_entries_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"labour_rates": {
                  Row: {
                    "activity": Database["public"]['Enums']["labour_activity"],"basis": Database["public"]['Enums']["labour_basis"],"cold_premium_type": Database["public"]['Enums']["premium_type"],"cold_premium_value": number,"created_at": string,"deleted_at": string | null,"id": string,"night_multiplier_bp": number,"notes": string | null,"overtime_multiplier_bp": number,"rate_card_id": string,"rate_paise": number,"updated_at": string,"valid_from": string,"valid_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": Database["public"]['Enums']["labour_activity"],"basis": Database["public"]['Enums']["labour_basis"],"cold_premium_type"?: Database["public"]['Enums']["premium_type"],"cold_premium_value"?: number,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"night_multiplier_bp"?: number,"notes"?: string | null,"overtime_multiplier_bp"?: number,"rate_card_id": string,"rate_paise": number,"updated_at"?: string,"valid_from": string,"valid_to"?: string | null
                  }
                  Update: {
                    "activity"?: Database["public"]['Enums']["labour_activity"],"basis"?: Database["public"]['Enums']["labour_basis"],"cold_premium_type"?: Database["public"]['Enums']["premium_type"],"cold_premium_value"?: number,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"night_multiplier_bp"?: number,"notes"?: string | null,"overtime_multiplier_bp"?: number,"rate_card_id"?: string,"rate_paise"?: number,"updated_at"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "labour_rates_rate_card_id_fkey"
      columns: ["rate_card_id"]
isOneToOne: false
      referencedRelation: "rate_cards"
      referencedColumns: ["id"]
    }
                  ]
                },"maintenance_tasks": {
                  Row: {
                    "alert_id": string | null,"assigned_to": string | null,"completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string | null,"due_date": string,"equipment_id": string,"id": string,"notes": string | null,"photos": (string)[],"reminded_1": boolean,"reminded_7": boolean,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id"?: string | null,"assigned_to"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date": string,"equipment_id": string,"id"?: string,"notes"?: string | null,"photos"?: (string)[],"reminded_1"?: boolean,"reminded_7"?: boolean,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "alert_id"?: string | null,"assigned_to"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date"?: string,"equipment_id"?: string,"id"?: string,"notes"?: string | null,"photos"?: (string)[],"reminded_1"?: boolean,"reminded_7"?: boolean,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_tasks_alert_fk"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_tasks_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_tasks_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "maintenance_tasks_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "maintenance_tasks_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "alert_id": string | null,"attempts": number,"body": string,"channel": string,"created_at": string,"error": string | null,"id": string,"sent_at": string | null,"status": string,"subject": string | null,"task_id": string | null,"to_address": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id"?: string | null,"attempts"?: number,"body": string,"channel": string,"created_at"?: string,"error"?: string | null,"id"?: string,"sent_at"?: string | null,"status"?: string,"subject"?: string | null,"task_id"?: string | null,"to_address": string
                  }
                  Update: {
                    "alert_id"?: string | null,"attempts"?: number,"body"?: string,"channel"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"sent_at"?: string | null,"status"?: string,"subject"?: string | null,"task_id"?: string | null,"to_address"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "maintenance_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "alert_id": string | null,"body": string | null,"created_at": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"task_id": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"read_at"?: string | null,"task_id"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "alert_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"task_id"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "maintenance_tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"occupancy_runs": {
                  Row: {
                    "occ_date": string,"row_count": number,"run_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "occ_date": string,"row_count": number,"run_at"?: string
                  }
                  Update: {
                    "occ_date"?: string,"row_count"?: number,"run_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"opening_balances": {
                  Row: {
                    "amount_paise": number,"as_of": string,"client_id": string,"created_at": string,"created_by": string | null,"id": string,"notes": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"as_of": string,"client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount_paise"?: number,"as_of"?: string,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opening_balances_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"other_charges": {
                  Row: {
                    "calc": Database["public"]['Enums']["charge_calc"],"code": string,"created_at": string,"deleted_at": string | null,"fixed_amount_paise": number,"gst_rate_bp": number | null,"id": string,"is_active": boolean,"name": string,"percent_base": string,"percent_bp": number,"sac_code": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calc"?: Database["public"]['Enums']["charge_calc"],"code": string,"created_at"?: string,"deleted_at"?: string | null,"fixed_amount_paise"?: number,"gst_rate_bp"?: number | null,"id"?: string,"is_active"?: boolean,"name": string,"percent_base"?: string,"percent_bp"?: number,"sac_code"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "calc"?: Database["public"]['Enums']["charge_calc"],"code"?: string,"created_at"?: string,"deleted_at"?: string | null,"fixed_amount_paise"?: number,"gst_rate_bp"?: number | null,"id"?: string,"is_active"?: boolean,"name"?: string,"percent_base"?: string,"percent_bp"?: number,"sac_code"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_allocations": {
                  Row: {
                    "amount_paise": number,"created_at": string,"doc_id": string,"doc_type": string,"id": string,"payment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"doc_id": string,"doc_type": string,"id"?: string,"payment_id": string
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"doc_id"?: string,"doc_type"?: string,"id"?: string,"payment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"client_id": string,"created_at": string,"created_by": string | null,"external_ref": string | null,"id": string,"method": Database["public"]['Enums']["payment_method"],"notes": string | null,"paid_on": string,"payment_no": string,"reference": string | null,"reversed_at": string | null,"reversed_reason": string | null,"status": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"client_id": string,"created_at"?: string,"created_by"?: string | null,"external_ref"?: string | null,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"notes"?: string | null,"paid_on": string,"payment_no": string,"reference"?: string | null,"reversed_at"?: string | null,"reversed_reason"?: string | null,"status"?: string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "amount_paise"?: number,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"external_ref"?: string | null,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"notes"?: string | null,"paid_on"?: string,"payment_no"?: string,"reference"?: string | null,"reversed_at"?: string | null,"reversed_reason"?: string | null,"status"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "payments_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "payments_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "client_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"email": string,"full_name": string,"id": string,"is_active": boolean,"must_change_password": boolean,"phone": string | null,"preferred_language": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email": string,"full_name"?: string,"id": string,"is_active"?: boolean,"must_change_password"?: boolean,"phone"?: string | null,"preferred_language"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"must_change_password"?: boolean,"phone"?: string | null,"preferred_language"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "profiles_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "profiles_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_cards": {
                  Row: {
                    "client_id": string | null,"created_at": string,"deleted_at": string | null,"free_days": number,"group_id": string | null,"id": string,"is_active": boolean,"labour_discount_bp": number,"min_billing_days": number,"name": string,"notes": string | null,"rent_discount_bp": number,"scope": Database["public"]['Enums']["rate_scope"],"updated_at": string,"valid_from": string,"valid_to": string | null,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"free_days"?: number,"group_id"?: string | null,"id"?: string,"is_active"?: boolean,"labour_discount_bp"?: number,"min_billing_days"?: number,"name": string,"notes"?: string | null,"rent_discount_bp"?: number,"scope": Database["public"]['Enums']["rate_scope"],"updated_at"?: string,"valid_from"?: string,"valid_to"?: string | null,"warehouse_id"?: string | null
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"free_days"?: number,"group_id"?: string | null,"id"?: string,"is_active"?: boolean,"labour_discount_bp"?: number,"min_billing_days"?: number,"name"?: string,"notes"?: string | null,"rent_discount_bp"?: number,"scope"?: Database["public"]['Enums']["rate_scope"],"updated_at"?: string,"valid_from"?: string,"valid_to"?: string | null,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rate_cards_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rate_cards_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "client_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rate_cards_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "rate_cards_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "rate_cards_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hits"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"readings": {
                  Row: {
                    "note": string | null,"photo_path": string | null,"raw_value": number,"recorded_at": string,"recorded_by": string | null,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value": number,"recorded_at": string,"recorded_by"?: string | null,"sensor_id": string,"source"?: Database["public"]['Enums']["reading_source"],"value": number
                  }
                  Update: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"sensor_id"?: string,"source"?: Database["public"]['Enums']["reading_source"],"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "readings_sensor_id_fkey"
      columns: ["sensor_id"]
isOneToOne: false
      referencedRelation: "sensors"
      referencedColumns: ["id"]
    }
                  ]
                },"readings_hourly": {
                  Row: {
                    "avg_value": number,"hour": string,"max_value": number,"min_value": number,"n": number,"sensor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_value": number,"hour": string,"max_value": number,"min_value": number,"n": number,"sensor_id": string
                  }
                  Update: {
                    "avg_value"?: number,"hour"?: string,"max_value"?: number,"min_value"?: number,"n"?: number,"sensor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "readings_hourly_sensor_id_fkey"
      columns: ["sensor_id"]
isOneToOne: false
      referencedRelation: "sensors"
      referencedColumns: ["id"]
    }
                  ]
                },"readings_y2026m09": {
                  Row: {
                    "note": string | null,"photo_path": string | null,"raw_value": number,"recorded_at": string,"recorded_by": string | null,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value": number,"recorded_at": string,"recorded_by"?: string | null,"sensor_id": string,"source"?: Database["public"]['Enums']["reading_source"],"value": number
                  }
                  Update: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"sensor_id"?: string,"source"?: Database["public"]['Enums']["reading_source"],"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"readings_y2026m10": {
                  Row: {
                    "note": string | null,"photo_path": string | null,"raw_value": number,"recorded_at": string,"recorded_by": string | null,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value": number,"recorded_at": string,"recorded_by"?: string | null,"sensor_id": string,"source"?: Database["public"]['Enums']["reading_source"],"value": number
                  }
                  Update: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"sensor_id"?: string,"source"?: Database["public"]['Enums']["reading_source"],"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"readings_y2026m11": {
                  Row: {
                    "note": string | null,"photo_path": string | null,"raw_value": number,"recorded_at": string,"recorded_by": string | null,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value": number,"recorded_at": string,"recorded_by"?: string | null,"sensor_id": string,"source"?: Database["public"]['Enums']["reading_source"],"value": number
                  }
                  Update: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"sensor_id"?: string,"source"?: Database["public"]['Enums']["reading_source"],"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"readings_y2026m12": {
                  Row: {
                    "note": string | null,"photo_path": string | null,"raw_value": number,"recorded_at": string,"recorded_by": string | null,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value": number,"recorded_at": string,"recorded_by"?: string | null,"sensor_id": string,"source"?: Database["public"]['Enums']["reading_source"],"value": number
                  }
                  Update: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"sensor_id"?: string,"source"?: Database["public"]['Enums']["reading_source"],"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"readings_y2027m01": {
                  Row: {
                    "note": string | null,"photo_path": string | null,"raw_value": number,"recorded_at": string,"recorded_by": string | null,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value": number,"recorded_at": string,"recorded_by"?: string | null,"sensor_id": string,"source"?: Database["public"]['Enums']["reading_source"],"value": number
                  }
                  Update: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"sensor_id"?: string,"source"?: Database["public"]['Enums']["reading_source"],"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"readings_y2027m02": {
                  Row: {
                    "note": string | null,"photo_path": string | null,"raw_value": number,"recorded_at": string,"recorded_by": string | null,"sensor_id": string,"source": Database["public"]['Enums']["reading_source"],"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value": number,"recorded_at": string,"recorded_by"?: string | null,"sensor_id": string,"source"?: Database["public"]['Enums']["reading_source"],"value": number
                  }
                  Update: {
                    "note"?: string | null,"photo_path"?: string | null,"raw_value"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"sensor_id"?: string,"source"?: Database["public"]['Enums']["reading_source"],"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"reminder_queue": {
                  Row: {
                    "client_id": string,"created_at": string,"days_after_due": number,"error": string | null,"id": string,"invoice_id": string,"sent_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"days_after_due": number,"error"?: string | null,"id"?: string,"invoice_id": string,"sent_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"days_after_due"?: number,"error"?: string | null,"id"?: string,"invoice_id"?: string,"sent_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_queue_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminder_queue_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"rent_rates": {
                  Row: {
                    "basis": Database["public"]['Enums']["rent_basis"],"brigade_type_id": string | null,"created_at": string,"deleted_at": string | null,"id": string,"notes": string | null,"rate_card_id": string,"rate_paise": number,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number | null,"temp_min": number | null,"tier_from": number | null,"tier_to": number | null,"updated_at": string,"valid_from": string,"valid_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "basis"?: Database["public"]['Enums']["rent_basis"],"brigade_type_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"rate_card_id": string,"rate_paise": number,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max"?: number | null,"temp_min"?: number | null,"tier_from"?: number | null,"tier_to"?: number | null,"updated_at"?: string,"valid_from": string,"valid_to"?: string | null
                  }
                  Update: {
                    "basis"?: Database["public"]['Enums']["rent_basis"],"brigade_type_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"rate_card_id"?: string,"rate_paise"?: number,"storage_type"?: Database["public"]['Enums']["storage_type"],"temp_max"?: number | null,"temp_min"?: number | null,"tier_from"?: number | null,"tier_to"?: number | null,"updated_at"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rent_rates_brigade_type_id_fkey"
      columns: ["brigade_type_id"]
isOneToOne: false
      referencedRelation: "brigade_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rent_rates_rate_card_id_fkey"
      columns: ["rate_card_id"]
isOneToOne: false
      referencedRelation: "rate_cards"
      referencedColumns: ["id"]
    }
                  ]
                },"sensors": {
                  Row: {
                    "battery_pct": number | null,"calibration_due_at": string | null,"calibration_offset": number,"created_at": string,"deleted_at": string | null,"id": string,"installed_on": string | null,"is_manual": boolean,"last_calibrated_at": string | null,"last_raw_value": number | null,"last_seen_at": string | null,"last_value": number | null,"name": string,"notes": string | null,"serial_no": string,"status": Database["public"]['Enums']["sensor_status"],"type": Database["public"]['Enums']["sensor_type"],"unit": string,"updated_at": string,"warehouse_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "battery_pct"?: number | null,"calibration_due_at"?: string | null,"calibration_offset"?: number,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"installed_on"?: string | null,"is_manual"?: boolean,"last_calibrated_at"?: string | null,"last_raw_value"?: number | null,"last_seen_at"?: string | null,"last_value"?: number | null,"name": string,"notes"?: string | null,"serial_no": string,"status"?: Database["public"]['Enums']["sensor_status"],"type"?: Database["public"]['Enums']["sensor_type"],"unit"?: string,"updated_at"?: string,"warehouse_id": string,"zone_id": string
                  }
                  Update: {
                    "battery_pct"?: number | null,"calibration_due_at"?: string | null,"calibration_offset"?: number,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"installed_on"?: string | null,"is_manual"?: boolean,"last_calibrated_at"?: string | null,"last_raw_value"?: number | null,"last_seen_at"?: string | null,"last_value"?: number | null,"name"?: string,"notes"?: string | null,"serial_no"?: string,"status"?: Database["public"]['Enums']["sensor_status"],"type"?: Database["public"]['Enums']["sensor_type"],"unit"?: string,"updated_at"?: string,"warehouse_id"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sensors_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "sensors_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "sensors_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sensors_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "sensors_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"shift_roster": {
                  Row: {
                    "created_at": string,"id": string,"shift_id": string,"user_id": string,"warehouse_id": string,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"shift_id": string,"user_id": string,"warehouse_id": string,"work_date": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"shift_id"?: string,"user_id"?: string,"warehouse_id"?: string,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shift_roster_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_roster_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shift_roster_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "shift_roster_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "shift_roster_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts": {
                  Row: {
                    "created_at": string,"ends_at": string,"id": string,"is_active": boolean,"name": string,"starts_at": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at": string,"id"?: string,"is_active"?: boolean,"name": string,"starts_at": string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"starts_at"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "shifts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "shifts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"slot_allocations": {
                  Row: {
                    "brigade_type_id": string,"cancelled": boolean,"client_id": string,"created_at": string,"end_date": string | null,"end_document_id": string | null,"end_document_type": string | null,"id": string,"min_days_invoice_id": string | null,"slot_id": string,"start_date": string,"start_document_id": string | null,"start_document_type": string | null,"updated_at": string,"warehouse_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brigade_type_id": string,"cancelled"?: boolean,"client_id": string,"created_at"?: string,"end_date"?: string | null,"end_document_id"?: string | null,"end_document_type"?: string | null,"id"?: string,"min_days_invoice_id"?: string | null,"slot_id": string,"start_date": string,"start_document_id"?: string | null,"start_document_type"?: string | null,"updated_at"?: string,"warehouse_id": string,"zone_id": string
                  }
                  Update: {
                    "brigade_type_id"?: string,"cancelled"?: boolean,"client_id"?: string,"created_at"?: string,"end_date"?: string | null,"end_document_id"?: string | null,"end_document_type"?: string | null,"id"?: string,"min_days_invoice_id"?: string | null,"slot_id"?: string,"start_date"?: string,"start_document_id"?: string | null,"start_document_type"?: string | null,"updated_at"?: string,"warehouse_id"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "slot_allocations_brigade_type_id_fkey"
      columns: ["brigade_type_id"]
isOneToOne: false
      referencedRelation: "brigade_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slot_allocations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slot_allocations_min_fk"
      columns: ["min_days_invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slot_allocations_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "brigade_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slot_allocations_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "slot_allocations_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "slot_allocations_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slot_allocations_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "slot_allocations_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"space_bookings": {
                  Row: {
                    "booking_no": string | null,"brigade_type_id": string | null,"brigades_requested": number,"client_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"deleted_at": string | null,"expected_days": number,"from_date": string,"id": string,"remarks": string | null,"requested_by": string | null,"reserved_count": number,"status": Database["public"]['Enums']["booking_status"],"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number | null,"temp_min": number | null,"temp_setpoint_c": number | null,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_no"?: string | null,"brigade_type_id"?: string | null,"brigades_requested": number,"client_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"deleted_at"?: string | null,"expected_days": number,"from_date": string,"id"?: string,"remarks"?: string | null,"requested_by"?: string | null,"reserved_count"?: number,"status"?: Database["public"]['Enums']["booking_status"],"storage_type": Database["public"]['Enums']["storage_type"],"temp_max"?: number | null,"temp_min"?: number | null,"temp_setpoint_c"?: number | null,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "booking_no"?: string | null,"brigade_type_id"?: string | null,"brigades_requested"?: number,"client_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"deleted_at"?: string | null,"expected_days"?: number,"from_date"?: string,"id"?: string,"remarks"?: string | null,"requested_by"?: string | null,"reserved_count"?: number,"status"?: Database["public"]['Enums']["booking_status"],"storage_type"?: Database["public"]['Enums']["storage_type"],"temp_max"?: number | null,"temp_min"?: number | null,"temp_setpoint_c"?: number | null,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "space_bookings_brigade_type_id_fkey"
      columns: ["brigade_type_id"]
isOneToOne: false
      referencedRelation: "brigade_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "space_bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "space_bookings_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "space_bookings_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "space_bookings_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_items": {
                  Row: {
                    "batch_no": string | null,"client_id": string,"condition": Database["public"]['Enums']["stock_condition"],"created_at": string,"deleted_at": string | null,"expiry_date": string | null,"id": string,"inward_line_id": string | null,"inward_receipt_id": string | null,"item_name": string,"mfg_date": string | null,"packages": number,"quantity": number,"received_at": string,"required_temp_c": number | null,"sku": string | null,"slot_code": string,"slot_id": string,"storage_type": Database["public"]['Enums']["storage_type"] | null,"unit": string,"unit_weight_kg": number,"updated_at": string,"warehouse_id": string,"weight_kg": number,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_no"?: string | null,"client_id": string,"condition"?: Database["public"]['Enums']["stock_condition"],"created_at"?: string,"deleted_at"?: string | null,"expiry_date"?: string | null,"id"?: string,"inward_line_id"?: string | null,"inward_receipt_id"?: string | null,"item_name": string,"mfg_date"?: string | null,"packages"?: number,"quantity": number,"received_at"?: string,"required_temp_c"?: number | null,"sku"?: string | null,"slot_code": string,"slot_id": string,"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"unit": string,"unit_weight_kg"?: number,"updated_at"?: string,"warehouse_id": string,"weight_kg"?: number,"zone_id": string
                  }
                  Update: {
                    "batch_no"?: string | null,"client_id"?: string,"condition"?: Database["public"]['Enums']["stock_condition"],"created_at"?: string,"deleted_at"?: string | null,"expiry_date"?: string | null,"id"?: string,"inward_line_id"?: string | null,"inward_receipt_id"?: string | null,"item_name"?: string,"mfg_date"?: string | null,"packages"?: number,"quantity"?: number,"received_at"?: string,"required_temp_c"?: number | null,"sku"?: string | null,"slot_code"?: string,"slot_id"?: string,"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"unit"?: string,"unit_weight_kg"?: number,"updated_at"?: string,"warehouse_id"?: string,"weight_kg"?: number,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_items_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_items_inward_line_id_fkey"
      columns: ["inward_line_id"]
isOneToOne: false
      referencedRelation: "inward_receipt_lines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_items_inward_receipt_id_fkey"
      columns: ["inward_receipt_id"]
isOneToOne: false
      referencedRelation: "inward_receipts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_items_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "brigade_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_items_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "stock_items_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "stock_items_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_items_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["zone_id"]
    },{
      foreignKeyName: "stock_items_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"document_id": string | null,"document_type": string | null,"from_slot_id": string | null,"id": number,"movement_type": Database["public"]['Enums']["movement_type"],"qty_delta": number,"reason": string | null,"stock_item_id": string,"to_slot_id": string | null,"warehouse_id": string,"weight_delta": number
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"document_id"?: string | null,"document_type"?: string | null,"from_slot_id"?: string | null,"id"?: never,"movement_type": Database["public"]['Enums']["movement_type"],"qty_delta": number,"reason"?: string | null,"stock_item_id": string,"to_slot_id"?: string | null,"warehouse_id": string,"weight_delta"?: number
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"document_id"?: string | null,"document_type"?: string | null,"from_slot_id"?: string | null,"id"?: never,"movement_type"?: Database["public"]['Enums']["movement_type"],"qty_delta"?: number,"reason"?: string | null,"stock_item_id"?: string,"to_slot_id"?: string | null,"warehouse_id"?: string,"weight_delta"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_from_slot_id_fkey"
      columns: ["from_slot_id"]
isOneToOne: false
      referencedRelation: "brigade_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_stock_item_id_fkey"
      columns: ["stock_item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_to_slot_id_fkey"
      columns: ["to_slot_id"]
isOneToOne: false
      referencedRelation: "brigade_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "stock_movements_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "stock_movements_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"support_tickets": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"id": string,"status": Database["public"]['Enums']["ticket_status"],"subject": string,"ticket_no": string,"updated_at": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["ticket_status"],"subject": string,"ticket_no"?: string,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["ticket_status"],"subject"?: string,"ticket_no"?: string,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_tickets_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_tickets_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_zone_slot_summary"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "support_tickets_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "support_tickets_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"tax_rules": {
                  Row: {
                    "created_at": string,"description": string | null,"gst_rate_bp": number,"id": string,"sac_code": string,"section": Database["public"]['Enums']["invoice_section"],"storage_type": Database["public"]['Enums']["storage_type"] | null,"updated_at": string,"valid_from": string,"valid_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"gst_rate_bp": number,"id"?: string,"sac_code": string,"section": Database["public"]['Enums']["invoice_section"],"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"updated_at"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"gst_rate_bp"?: number,"id"?: string,"sac_code"?: string,"section"?: Database["public"]['Enums']["invoice_section"],"storage_type"?: Database["public"]['Enums']["storage_type"] | null,"updated_at"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ticket_events": {
                  Row: {
                    "attachments": (string)[],"author_id": string | null,"body": string | null,"created_at": string,"from_staff": boolean,"id": string,"kind": string,"status": Database["public"]['Enums']["ticket_status"] | null,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments"?: (string)[],"author_id"?: string | null,"body"?: string | null,"created_at"?: string,"from_staff"?: boolean,"id"?: string,"kind": string,"status"?: Database["public"]['Enums']["ticket_status"] | null,"ticket_id": string
                  }
                  Update: {
                    "attachments"?: (string)[],"author_id"?: string | null,"body"?: string | null,"created_at"?: string,"from_staff"?: boolean,"id"?: string,"kind"?: string,"status"?: Database["public"]['Enums']["ticket_status"] | null,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_events_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "support_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"vacancies": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string | null,"id": string,"job_role": Database["public"]['Enums']["job_role"],"openings": number,"role_to_hire": Database["public"]['Enums']["app_role"],"status": Database["public"]['Enums']["vacancy_status"],"title": string,"updated_at": string,"warehouse_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"job_role"?: Database["public"]['Enums']["job_role"],"openings"?: number,"role_to_hire"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["vacancy_status"],"title": string,"updated_at"?: string,"warehouse_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"job_role"?: Database["public"]['Enums']["job_role"],"openings"?: number,"role_to_hire"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["vacancy_status"],"title"?: string,"updated_at"?: string,"warehouse_id"?: string | null
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
      referencedRelation: "warehouse_manager_counts"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "vacancies_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"vacancy_salaries": {
                  Row: {
                    "max_paise": number,"min_paise": number,"updated_at": string,"vacancy_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "max_paise": number,"min_paise": number,"updated_at"?: string,"vacancy_id": string
                  }
                  Update: {
                    "max_paise"?: number,"min_paise"?: number,"updated_at"?: string,"vacancy_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vacancy_salaries_vacancy_id_fkey"
      columns: ["vacancy_id"]
isOneToOne: true
      referencedRelation: "vacancies"
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
      referencedRelation: "warehouse_manager_counts"
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
      referencedRelation: "warehouse_manager_counts"
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
                    "blocked_slots": number | null,"free_slots": number | null,"occupied_slots": number | null,"reserved_slots": number | null,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number | null,"temp_min": number | null,"total_slots": number | null,"warehouse_code": string,"warehouse_id": string,"warehouse_name": string,"zone_code": string,"zone_id": string,"zone_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"warehouse_manager_counts": {
                  Row: {
                    "code": string,"managers": number | null,"name": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "code"?: string | null,"managers"?: never,"name"?: string | null,"warehouse_id"?: string | null
                         }
                        Update: {
                           "code"?: string | null,"managers"?: never,"name"?: string | null,"warehouse_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "_allocate_fifo":
{ Args: { "p_payment": string }; Returns: undefined
                           },
"_allocate_to":
{ Args: { "p_id": string,"p_max": number,"p_payment": string,"p_type": string }; Returns: number
                           },
"_doc_outstanding":
{ Args: { "p_id": string,"p_type": string }; Returns: number
                           },
"_draft_labour_lines":
{ Args: { "p_client": string,"p_inv": string,"p_to": string,"p_wh": string }; Returns: number
                           },
"_draft_rent_lines":
{ Args: { "p_client": string,"p_from": string,"p_inv": string,"p_to": string,"p_wh": string }; Returns: number
                           },
"_emit_rent_line":
{ Args: { "p_basis": Database["public"]['Enums']["rent_basis"],"p_chg": number,"p_client": string,"p_free": number,"p_from": string,"p_inv": string,"p_rate": number,"p_rate_id": string,"p_src": string,"p_st": Database["public"]['Enums']["storage_type"],"p_tmax": number,"p_tmin": number,"p_to": string,"p_vol": number,"p_wh": string }; Returns: undefined
                           },
"_rupees":
{ Args: { "p": number }; Returns: string
                           },
"acknowledge_alert":
{ Args: { "p_alert_id": string }; Returns: undefined
                           },
"add_manual_reading":
{ Args: { "p_note"?: string,"p_photo_path"?: string,"p_value": number,"p_zone_id": string }; Returns: string
                           },
"add_other_charge":
{ Args: { "p_amount_paise": number,"p_charge_id": string,"p_description": string,"p_gst_rate_bp"?: number,"p_invoice_id": string,"p_quantity": number,"p_reason": string,"p_sac_code"?: string }; Returns: string
                           },
"adjust_stock":
{ Args: { "p_new_quantity": number,"p_reason": string,"p_stock_item_id": string }; Returns: undefined
                           },
"admin_dashboard":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"affected_stock":
{ Args: { "p_from": string,"p_to": string,"p_zone_id": string }; Returns: {
              "batch_no": string,"client_id": string,"client_name": string,"expiry_date": string,"item_name": string,"quantity": number,"slot_code": string,"slot_id": string,"stock_item_id": string,"unit": string
            }[]
                           },
"ageing_report":
{ Args: { "p_as_of"?: string }; Returns: {
              "advance_paise": number,"b0_30": number,"b31_60": number,"b61_90": number,"b90_plus": number,"client_id": string,"client_name": string,"net_paise": number,"outstanding_paise": number
            }[]
                           },
"alert_recipients":
{ Args: { "p_level": number,"p_warehouse_id": string }; Returns: {
              "email": string,"phone": string,"user_id": string
            }[]
                           },
"alloc_counts_on":
{ Args: { "p_day": string,"p_end": string,"p_start": string }; Returns: boolean
                           },
"alloc_days":
{ Args: { "p_end": string,"p_start": string }; Returns: number
                           },
"apply_advances":
{ Args: { "p_client_id": string }; Returns: undefined
                           },
"approve_booking":
{ Args: { "p_booking_id": string,"p_note"?: string }; Returns: number
                           },
"approve_client_notice":
{ Args: { "p_body"?: string,"p_notice_id": string,"p_subject"?: string }; Returns: undefined
                           },
"approve_dispatch_request":
{ Args: { "p_note"?: string,"p_request_id": string }; Returns: number
                           },
"assign_manager":
{ Args: { "p_user_id": string,"p_warehouse_id": string }; Returns: undefined
                           },
"attendance_punch":
{ Args: { "p_at": string,"p_kind": string,"p_lat": number,"p_lon": number,"p_warehouse_id": string }; Returns: Json
                           },
"attendance_report":
{ Args: { "p_from": string,"p_to": string,"p_warehouse_id": string }; Returns: {
              "check_in_at": string,"check_out_at": string,"correction_status": Database["public"]['Enums']["correction_status"],"employee_code": string,"full_name": string,"gps_ok": boolean,"hours": number,"job_role": Database["public"]['Enums']["job_role"],"work_date": string
            }[]
                           },
"billing_block_reason":
{ Args: { "p_client_id": string }; Returns: string
                           },
"can_operate_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"can_read_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"can_see_client":
{ Args: { "p_client_id": string }; Returns: boolean
                           },
"can_view_billing":
{ Args: { "p_client_id": string,"p_warehouse_id": string }; Returns: boolean
                           },
"can_view_row":
{ Args: { "p_client_id": string,"p_warehouse_id": string }; Returns: boolean
                           },
"can_write_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"cancel_booking":
{ Args: { "p_booking_id": string,"p_reason": string }; Returns: undefined
                           },
"cancel_delivery_challan":
{ Args: { "p_challan_id": string,"p_reason": string }; Returns: undefined
                           },
"cancel_dispatch_request":
{ Args: { "p_reason": string,"p_request_id": string }; Returns: undefined
                           },
"cancel_inward_advice":
{ Args: { "p_advice_id": string }; Returns: undefined
                           },
"cancel_inward_receipt":
{ Args: { "p_reason": string,"p_receipt_id": string }; Returns: undefined
                           },
"cc":
{ Args: { "p_default": number,"p_key": string }; Returns: number
                           },
"check_in":
{ Args: { "p_at"?: string,"p_lat"?: number,"p_lon"?: number,"p_warehouse_id"?: string }; Returns: Json
                           },
"check_out":
{ Args: { "p_at"?: string,"p_lat"?: number,"p_lon"?: number,"p_warehouse_id"?: string }; Returns: Json
                           },
"check_space_availability":
{ Args: { "p_brigade_type_id"?: string,"p_setpoint"?: number,"p_storage_type": Database["public"]['Enums']["storage_type"],"p_temp_max"?: number,"p_temp_min"?: number,"p_warehouse_id": string }; Returns: {
              "free_slots": number,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number,"temp_min": number,"zone_code": string,"zone_id": string,"zone_name": string
            }[]
                           },
"cleanup_old_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"client_affected_by_alert":
{ Args: { "p_alert_id": string }; Returns: boolean
                           },
"client_dashboard":
{ Args: { "p_client_id"?: string }; Returns: Json
                           },
"client_has_active_contract":
{ Args: { "p_client_id": string,"p_on"?: string,"p_warehouse_id": string }; Returns: boolean
                           },
"client_ledger":
{ Args: { "p_client_id": string,"p_from"?: string,"p_to"?: string }; Returns: {
              "balance_paise": number,"credit_paise": number,"debit_paise": number,"description": string,"doc_id": string,"doc_no": string,"doc_type": string,"entry_date": string
            }[]
                           },
"client_lorry_temps":
{ Args: { "p_client_id": string,"p_from": string,"p_to": string }; Returns: {
              "at": string,"doc_no": string,"doc_type": string,"lorry_number": string,"temp_c": number
            }[]
                           },
"client_sees_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"client_temperature_report":
{ Args: { "p_client_id": string,"p_from": string,"p_to": string }; Returns: {
              "approx": boolean,"avg_c": number,"brigades": number,"from_date": string,"max_c": number,"min_c": number,"minutes_covered": number,"minutes_out": number,"minutes_period": number,"readings": number,"slots": (string)[],"temp_max": number,"temp_min": number,"to_date": string,"zone_code": string,"zone_id": string,"zone_name": string
            }[]
                           },
"close_alert":
{ Args: { "p_alert_id": string,"p_now": string,"p_recovered": string }; Returns: undefined
                           },
"cold_chain_overview":
{ Args: { "p_warehouse_id": string }; Returns: {
              "current_value": number,"last_at": string,"manual_only": boolean,"offline_after_min": number,"open_alerts": number,"sensor_count": number,"spark": Json,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number,"temp_min": number,"worst_severity": string,"zone_code": string,"zone_id": string,"zone_name": string
            }[]
                           },
"company_belongs_to_client":
{ Args: { "p_client_id": string,"p_company_id": string }; Returns: boolean
                           },
"complete_maintenance_task":
{ Args: { "p_notes"?: string,"p_photos"?: (string)[],"p_task_id": string }; Returns: undefined
                           },
"confirm_delivery_challan":
{ Args: { "p_dispatch_temp_c"?: number,"p_gate_entry_id": string,"p_labour"?: Json,"p_receiver_name"?: string,"p_remarks"?: string,"p_request_id": string,"p_seal_number"?: string,"p_signature_path"?: string }; Returns: string
                           },
"confirm_inward_receipt":
{ Args: { "p_gate_entry_id": string,"p_labour"?: Json,"p_lines": Json,"p_placements": Json,"p_remarks"?: string }; Returns: string
                           },
"copy_alert_evidence":
{ Args: { "p_alert_id": string,"p_now"?: string }; Returns: number
                           },
"create_brigade_slots":
{ Args: { "p_aisle_start"?: number,"p_aisles": number,"p_brigade_type_id": string,"p_levels": number,"p_racks": number,"p_slots_per_level"?: number,"p_zone_id": string }; Returns: number
                           },
"create_device_key":
{ Args: { "p_label": string,"p_sensor_id": string,"p_warehouse_id": string }; Returns: string
                           },
"create_inward_advice":
{ Args: { "p_client_id"?: string,"p_company_id": string,"p_driver_name": string,"p_driver_phone": string,"p_expected": string,"p_lines": Json,"p_lorry": string,"p_remarks": string,"p_warehouse_id": string }; Returns: string
                           },
"cron_health":
{ Args: Record<PropertyKey, never>; Returns: {
              "job": string,"last_error": string,"last_ok_at": string,"stale": boolean,"status": string
            }[]
                           },
"cron_run":
{ Args: { "p_job": string,"p_log"?: boolean,"p_max_age"?: number,"p_sql": string }; Returns: undefined
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"current_client_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decide_attendance_correction":
{ Args: { "p_approve": boolean,"p_attendance_id": string,"p_note"?: string }; Returns: undefined
                           },
"decide_client_change":
{ Args: { "p_approve": boolean,"p_note"?: string,"p_request_id": string }; Returns: undefined
                           },
"discard_draft_invoice":
{ Args: { "p_invoice_id": string,"p_reason": string }; Returns: undefined
                           },
"dispatch_backup":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"dispatch_notifications":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"effective_rule":
{ Args: { "p_zone_id": string }; Returns: Database["public"]['CompositeTypes']["effective_rule"]
                          SetofOptions: {
        from: "*"
        to: "effective_rule"
        isOneToOne: true
        isSetofReturn: false
      } },
"einvoice_json":
{ Args: { "p_invoice_id": string }; Returns: Json
                           },
"ensure_reading_partitions":
{ Args: { "p_ahead"?: number,"p_back"?: number }; Returns: number
                           },
"evaluate_alerts":
{ Args: { "p_now"?: string }; Returns: number
                           },
"exit_employee":
{ Args: { "p_employee_id": string,"p_exit_date"?: string }; Returns: undefined
                           },
"financial_year_label":
{ Args: { "p_date": string }; Returns: string
                           },
"fix_invoice_line":
{ Args: { "p_amount_paise": number,"p_exempt"?: boolean,"p_exempt_reason"?: string,"p_line_id": string,"p_reason": string }; Returns: undefined
                           },
"free_days_for":
{ Args: { "p_client_id": string,"p_date": string,"p_warehouse_id": string }; Returns: number
                           },
"generate_invoice_draft":
{ Args: { "p_client_id": string,"p_from": string,"p_mode"?: Database["public"]['Enums']["billing_mode"],"p_to": string,"p_warehouse_id": string }; Returns: string
                           },
"generate_scheduled_drafts":
{ Args: { "p_today"?: string }; Returns: number
                           },
"gst_split":
{ Args: { "p_exempt": boolean,"p_rate_bp": number,"p_supply_kind": string,"p_taxable": number }; Returns: {
              "cgst": number,"igst": number,"sgst": number
            }[]
                           },
"gstr1_register":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "category": string,"cgst_paise": number,"doc_date": string,"doc_no": string,"doc_type": string,"exempt_reason": string,"gst_rate_bp": number,"gstin": string,"igst_paise": number,"party_name": string,"place_of_supply": string,"sac_code": string,"section": string,"sgst_paise": number,"taxable_paise": number
            }[]
                           },
"haversine_m":
{ Args: { "a_lat": number,"a_lon": number,"b_lat": number,"b_lon": number }; Returns: number
                           },
"hr_object_allowed":
{ Args: { "p_name": string }; Returns: boolean
                           },
"hr_setting":
{ Args: { "p_key": string }; Returns: string
                           },
"import_rows":
{ Args: { "p_dry_run"?: boolean,"p_kind": string,"p_rows": Json }; Returns: Json
                           },
"in_defrost":
{ Args: { "p_ts": string,"p_zone_id": string }; Returns: boolean
                           },
"ingest_readings":
{ Args: { "p_key_hash": string,"p_now"?: string,"p_readings": Json }; Returns: Json
                           },
"invoice_outstanding":
{ Args: { "p_invoice_id": string }; Returns: number
                           },
"is_accountant":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_client":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_my_client":
{ Args: { "p_client_id": string }; Returns: boolean
                           },
"is_staff_of":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"is_valid_gstin":
{ Args: { "p": string }; Returns: boolean
                           },
"issue_adjustment_note":
{ Args: { "p_invoice_id": string,"p_kind": Database["public"]['Enums']["note_kind"],"p_lines"?: Json,"p_reason": string }; Returns: string
                           },
"issue_invoice":
{ Args: { "p_invoice_id": string }; Returns: string
                           },
"labour_rate_candidates":
{ Args: { "p_activity": Database["public"]['Enums']["labour_activity"],"p_client_id": string,"p_date": string,"p_warehouse_id": string }; Returns: {
              "basis": Database["public"]['Enums']["labour_basis"],"card_name": string,"cold_premium_type": Database["public"]['Enums']["premium_type"],"cold_premium_value": number,"labour_rate_id": string,"night_multiplier_bp": number,"overtime_multiplier_bp": number,"rank": number,"rate_card_id": string,"rate_paise": number,"scope": Database["public"]['Enums']["rate_scope"],"source": string
            }[]
                           },
"maintenance_reminders":
{ Args: { "p_now"?: string }; Returns: number
                           },
"managed_warehouse_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"manager_dashboard":
{ Args: { "p_warehouse_id": string }; Returns: Json
                           },
"manages_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"manual_sensor_for_zone":
{ Args: { "p_zone_id": string }; Returns: string
                           },
"mark_advice_arrived":
{ Args: { "p_advice_id": string,"p_lorry"?: string }; Returns: string
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: undefined
                           },
"mark_overdue_invoices":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"mfa_required":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_rate_summary":
{ Args: Record<PropertyKey, never>; Returns: {
              "basis": string,"detail": string,"kind": string,"label": string,"rate_paise": number,"scope": string
            }[]
                           },
"my_security_state":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"next_doc_number":
{ Args: { "p_date"?: string,"p_doc_type": string,"p_warehouse_id": string }; Returns: string
                           },
"notify_alert":
{ Args: { "p_alert_id": string,"p_headline": string,"p_level": number }; Returns: number
                           },
"notify_client":
{ Args: { "p_body": string,"p_client_id": string,"p_email"?: boolean,"p_kind": string,"p_link"?: string,"p_title": string }; Returns: undefined
                           },
"occupy_slot":
{ Args: { "p_add_weight": number,"p_client_id": string,"p_doc_id": string,"p_doc_type": string,"p_on": string,"p_required_temp": number,"p_slot_id": string,"p_storage_type": Database["public"]['Enums']["storage_type"],"p_warehouse_id": string }; Returns: {
              "aisle": number,
"booking_id": string | null,
"brigade_type_id": string,
"code": string,
"created_at": string,
"deleted_at": string | null,
"id": string,
"level": number,
"notes": string | null,
"position": number,
"rack": number,
"reserved_client_id": string | null,
"status": Database["public"]['Enums']["slot_status"],
"updated_at": string,
"warehouse_id": string,
"zone_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "brigade_slots"
        isOneToOne: true
        isSetofReturn: false
      } },
"on_duty_at":
{ Args: { "p_at"?: string,"p_warehouse_id": string }; Returns: {
              "check_in_at": string,"full_name": string,"job_role": Database["public"]['Enums']["job_role"],"user_id": string
            }[]
                           },
"open_alert":
{ Args: { "p_dev": number,"p_headline": string,"p_kind": Database["public"]['Enums']["alert_kind"],"p_limit": number,"p_now": string,"p_peak": number,"p_sensor": string,"p_sev": Database["public"]['Enums']["alert_severity"],"p_start": string,"p_zone": string }; Returns: string
                           },
"open_ticket":
{ Args: { "p_attachments"?: (string)[],"p_body": string,"p_client_id"?: string,"p_subject": string,"p_warehouse_id"?: string }; Returns: string
                           },
"path_warehouse_id":
{ Args: { "p_name": string }; Returns: string
                           },
"queue_message":
{ Args: { "p_alert"?: string,"p_body": string,"p_email": string,"p_kind": string,"p_phone": string,"p_task"?: string,"p_title": string,"p_user": string }; Returns: undefined
                           },
"quick_create_client":
{ Args: { "p_gstin"?: string,"p_name": string,"p_phone"?: string }; Returns: string
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"readable_warehouse_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"reading_visible_to_client":
{ Args: { "p_sensor_id": string,"p_ts": string }; Returns: boolean
                           },
"recalculate_invoice":
{ Args: { "p_invoice_id": string }; Returns: undefined
                           },
"record_calibration":
{ Args: { "p_certificate_path"?: string,"p_date": string,"p_next_due"?: string,"p_notes"?: string,"p_reference": number,"p_sensor_id": string,"p_sensor_value": number }; Returns: string
                           },
"record_challan_pod":
{ Args: { "p_challan_id": string,"p_receiver_name": string,"p_signature_path": string }; Returns: undefined
                           },
"record_payment":
{ Args: { "p_amount_paise": number,"p_client_id": string,"p_external_ref"?: string,"p_invoice_id"?: string,"p_method": Database["public"]['Enums']["payment_method"],"p_notes"?: string,"p_paid_on": string,"p_reference": string,"p_warehouse_id": string }; Returns: string
                           },
"record_pick_scan":
{ Args: { "p_code": string,"p_pick_id": string }; Returns: {
              "batch_no": string | null,
"client_id": string,
"created_at": string,
"expiry_date": string | null,
"id": string,
"item_name": string,
"pick_seq": number,
"picked": boolean,
"picked_at": string | null,
"picked_by": string | null,
"quantity": number,
"request_id": string,
"request_line_id": string,
"sku": string | null,
"slot_code": string,
"slot_id": string,
"stock_item_id": string,
"updated_at": string,
"warehouse_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "dispatch_picks"
        isOneToOne: true
        isSetofReturn: false
      } },
"refresh_invoice_state":
{ Args: { "p_invoice_id": string }; Returns: undefined
                           },
"reject_booking":
{ Args: { "p_booking_id": string,"p_note": string }; Returns: undefined
                           },
"reject_client_notice":
{ Args: { "p_notice_id": string }; Returns: undefined
                           },
"reject_dispatch_request":
{ Args: { "p_note": string,"p_request_id": string }; Returns: undefined
                           },
"release_slot_if_empty":
{ Args: { "p_doc_id": string,"p_doc_type": string,"p_on": string,"p_slot_id": string }; Returns: undefined
                           },
"remove_invoice_line":
{ Args: { "p_line_id": string,"p_reason": string }; Returns: undefined
                           },
"remove_manager":
{ Args: { "p_confirm"?: boolean,"p_user_id": string,"p_warehouse_id": string }; Returns: Json
                           },
"rent_rate_candidates":
{ Args: { "p_brigade_type_id": string,"p_brigades"?: number,"p_client_id": string,"p_date": string,"p_storage_type": Database["public"]['Enums']["storage_type"],"p_temp_max": number,"p_temp_min": number,"p_warehouse_id": string }; Returns: {
              "basis": Database["public"]['Enums']["rent_basis"],"card_name": string,"rank": number,"rate_card_id": string,"rate_paise": number,"rent_rate_id": string,"scope": Database["public"]['Enums']["rate_scope"],"source": string,"tier_from": number,"tier_to": number
            }[]
                           },
"reply_ticket":
{ Args: { "p_attachments"?: (string)[],"p_body": string,"p_ticket_id": string }; Returns: undefined
                           },
"report_revenue":
{ Args: { "p_from": string,"p_group"?: string,"p_to": string }; Returns: {
              "bucket": string,"labour_paise": number,"other_paise": number,"rent_paise": number,"tax_paise": number,"total_paise": number
            }[]
                           },
"report_rows":
{ Args: { "p_client"?: string,"p_from": string,"p_limit"?: number,"p_offset"?: number,"p_report": string,"p_to": string,"p_warehouse"?: string }; Returns: Json
                           },
"report_utilisation":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "available_brigade_days": number,"billed_brigade_days": number,"held_brigade_days": number,"utilisation_bp": number,"warehouse": string,"warehouse_id": string
            }[]
                           },
"request_attendance_correction":
{ Args: { "p_in": string,"p_out": string,"p_reason": string,"p_warehouse_id"?: string,"p_work_date": string }; Returns: string
                           },
"request_client_change":
{ Args: { "p_changes": Json }; Returns: string
                           },
"resolve_alert":
{ Args: { "p_action": string,"p_alert_id": string,"p_cause": string,"p_create_task"?: boolean,"p_equipment_id"?: string,"p_task_due"?: string }; Returns: undefined
                           },
"resolve_labour_rate":
{ Args: { "p_activity": Database["public"]['Enums']["labour_activity"],"p_client_id": string,"p_date": string,"p_warehouse_id": string }; Returns: {
              "basis": Database["public"]['Enums']["labour_basis"],"cold_premium_type": Database["public"]['Enums']["premium_type"],"cold_premium_value": number,"labour_rate_id": string,"night_multiplier_bp": number,"overtime_multiplier_bp": number,"rate_card_id": string,"rate_paise": number,"scope": Database["public"]['Enums']["rate_scope"],"source": string
            }[]
                           },
"resolve_rate_terms":
{ Args: { "p_client_id": string,"p_date": string,"p_warehouse_id": string }; Returns: {
              "free_days": number,"labour_discount_bp": number,"min_billing_days": number,"rate_card_id": string,"rent_discount_bp": number,"scope": Database["public"]['Enums']["rate_scope"]
            }[]
                           },
"resolve_rent_rate":
{ Args: { "p_brigade_type_id": string,"p_brigades"?: number,"p_client_id": string,"p_date": string,"p_storage_type": Database["public"]['Enums']["storage_type"],"p_temp_max": number,"p_temp_min": number,"p_warehouse_id": string }; Returns: {
              "basis": Database["public"]['Enums']["rent_basis"],"rate_card_id": string,"rate_paise": number,"rent_rate_id": string,"scope": Database["public"]['Enums']["rate_scope"],"source": string
            }[]
                           },
"resolve_tax_rule":
{ Args: { "p_date": string,"p_section": Database["public"]['Enums']["invoice_section"],"p_storage_type": Database["public"]['Enums']["storage_type"] }; Returns: {
              "gst_rate_bp": number,"sac_code": string
            }[]
                           },
"reverse_payment":
{ Args: { "p_payment_id": string,"p_reason": string }; Returns: undefined
                           },
"revoke_device_key":
{ Args: { "p_key_id": string }; Returns: undefined
                           },
"rollup_readings":
{ Args: { "p_now"?: string }; Returns: Json
                           },
"rotate_device_key":
{ Args: { "p_key_id": string }; Returns: string
                           },
"set_billing_override":
{ Args: { "p_client_id": string,"p_reason": string,"p_until": string }; Returns: undefined
                           },
"set_crew":
{ Args: { "p_document_id": string,"p_document_type": string,"p_user_ids": (string)[] }; Returns: number
                           },
"set_internal_secret":
{ Args: { "p_key": string,"p_value": string }; Returns: undefined
                           },
"set_require_admin_mfa":
{ Args: { "p_on": boolean }; Returns: undefined
                           },
"set_ticket_status":
{ Args: { "p_note"?: string,"p_status": Database["public"]['Enums']["ticket_status"],"p_ticket_id": string }; Returns: undefined
                           },
"setting_json":
{ Args: { "p_key": string }; Returns: Json
                           },
"slot_load_kg":
{ Args: { "p_slot_id": string }; Returns: number
                           },
"snapshot_alert_stock":
{ Args: { "p_alert_id": string,"p_now"?: string }; Returns: number
                           },
"snapshot_occupancy":
{ Args: { "p_date": string }; Returns: number
                           },
"snapshot_occupancy_backfill":
{ Args: { "p_force"?: boolean,"p_from"?: string,"p_to"?: string }; Returns: number
                           },
"stock_available_qty":
{ Args: { "p_stock_item_id": string }; Returns: number
                           },
"stock_reserved_qty":
{ Args: { "p_stock_item_id": string }; Returns: number
                           },
"suggest_inward_slots":
{ Args: { "p_counts"?: Json,"p_gate_entry_id": string }; Returns: {
              "condition": Database["public"]['Enums']["stock_condition"],"gate_entry_line_id": string,"quantity": number,"reserved": boolean,"slot_code": string,"slot_id": string,"zone_code": string
            }[]
                           },
"supply_kind_for":
{ Args: { "p_client_id": string }; Returns: {
              "kind": string,"place": string
            }[]
                           },
"tally_export_xml":
{ Args: { "p_from": string,"p_to": string }; Returns: string
                           },
"temp_dev":
{ Args: { "p_hi": number,"p_lo": number,"p_tol": number,"p_ts": string,"p_value": number,"p_zone": string }; Returns: number
                           },
"ticket_object_allowed":
{ Args: { "p_name": string }; Returns: boolean
                           },
"today_ist":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"transfer_stock":
{ Args: { "p_quantity": number,"p_reason"?: string,"p_stock_item_id": string,"p_to_slot_id": string }; Returns: string
                           },
"update_maintenance_task":
{ Args: { "p_notes"?: string,"p_photos"?: (string)[],"p_status": Database["public"]['Enums']["task_status"],"p_task_id": string }; Returns: undefined
                           },
"zone_matches_temp":
{ Args: { "r_max": number,"r_min": number,"r_set": number,"r_type": Database["public"]['Enums']["storage_type"],"z_max": number,"z_min": number,"z_type": Database["public"]['Enums']["storage_type"] }; Returns: boolean
                           },
"zone_series":
{ Args: { "p_bucket_min"?: number,"p_from": string,"p_to": string,"p_zone_id": string }; Returns: {
              "avg_v": number,"bucket": string,"max_v": number,"min_v": number,"n": number
            }[]
                           }
          }
          Enums: {
            "alert_kind": "TEMP_HIGH"|"TEMP_LOW"|"OFFLINE"|"DOOR_OPEN"|"POWER_FAILURE"|"COMPRESSOR_FAULT"|"HUMIDITY"|"CALIBRATION_DUE"|"BATTERY_LOW","alert_severity": "WARNING"|"CRITICAL","alert_status": "OPEN"|"ACKNOWLEDGED"|"RESOLVED","app_role": "SUPER_ADMIN"|"WAREHOUSE_MANAGER"|"STAFF"|"CLIENT"|"ACCOUNTANT","applicant_status": "APPLIED"|"SHORTLISTED"|"INTERVIEW"|"OFFERED"|"JOINED"|"REJECTED","audit_action": "INSERT"|"UPDATE"|"DELETE","billing_cycle": "WEEKLY"|"MONTHLY"|"ON_DEMAND","billing_mode": "RENT_ONLY"|"LABOUR_ONLY"|"BOTH","booking_status": "REQUESTED"|"APPROVED"|"REJECTED"|"CANCELLED"|"COMPLETED","charge_calc": "FIXED"|"PERCENT","client_status": "ACTIVE"|"ON_HOLD"|"INACTIVE","company_kind": "SENDER"|"RECEIVER"|"BOTH","contract_status": "DRAFT"|"ACTIVE"|"EXPIRED"|"TERMINATED","correction_status": "NONE"|"PENDING"|"APPROVED"|"REJECTED","dispatch_status": "REQUESTED"|"APPROVED"|"REJECTED"|"PICKING"|"DISPATCHED"|"CANCELLED","document_status": "CONFIRMED"|"CANCELLED","employee_status": "ACTIVE"|"ON_LEAVE"|"EXITED","equipment_type": "CHILLER"|"COMPRESSOR"|"GENERATOR"|"FORKLIFT"|"RACK"|"OTHER","gate_direction": "INWARD"|"OUTWARD","gate_status": "AT_GATE"|"UNLOADING"|"RECEIVED"|"LOADING"|"DISPATCHED"|"CANCELLED","invoice_section": "RENT"|"LABOUR"|"OTHER","invoice_status": "DRAFT"|"ISSUED"|"PARTIALLY_PAID"|"PAID"|"OVERDUE"|"CANCELLED","job_role": "MANAGER"|"PICKER"|"LOADER"|"SECURITY"|"ACCOUNTANT","labour_activity": "UNLOADING"|"SORTING"|"STACKING"|"LABELLING"|"LOADING"|"PICKING"|"PACKING","labour_basis": "PER_PACKAGE"|"PER_TONNE"|"PER_BRIGADE_MOVED"|"PER_HOUR"|"FLAT_PER_LORRY","line_condition": "GOOD"|"DAMAGED"|"SHORT","movement_type": "IN"|"OUT"|"TRANSFER"|"ADJUSTMENT","note_kind": "CREDIT"|"DEBIT","payment_method": "UPI"|"BANK_TRANSFER"|"CHEQUE"|"CASH"|"ONLINE"|"DEPOSIT_ADJUSTMENT","pick_rule": "FEFO"|"FIFO","premium_type": "NONE"|"PERCENT"|"AMOUNT","rate_scope": "CLIENT"|"GROUP"|"WAREHOUSE"|"GLOBAL","reading_source": "SENSOR"|"MANUAL","rent_basis": "PER_BRIGADE"|"PER_M3","request_status": "PENDING"|"APPROVED"|"REJECTED","sensor_status": "ACTIVE"|"OFFLINE"|"FAULTY"|"RETIRED","sensor_type": "TEMPERATURE"|"HUMIDITY"|"DOOR"|"POWER"|"COMPRESSOR","slot_status": "FREE"|"RESERVED"|"OCCUPIED"|"BLOCKED","stock_condition": "GOOD"|"DAMAGED","storage_type": "DRY"|"CHILLED"|"FROZEN"|"DEEP_FREEZE"|"BONDED"|"HAZMAT","task_status": "OPEN"|"IN_PROGRESS"|"DONE"|"CANCELLED","ticket_status": "OPEN"|"IN_PROGRESS"|"WAITING_CLIENT"|"RESOLVED"|"CLOSED","vacancy_status": "OPEN"|"ON_HOLD"|"CLOSED"
          }
          CompositeTypes: {
            "effective_rule": {
                        "enabled": boolean | null,"min_temp": number | null,"max_temp": number | null,"tolerance_deg": number | null,"delay_min": number | null,"critical_deviation_deg": number | null,"critical_after_min": number | null,"recovery_min": number | null,"offline_after_min": number | null,"door_open_after_min": number | null,"humidity_min": number | null,"humidity_max": number | null,"humidity_delay_min": number | null,"battery_low_pct": number | null,"calibration_warn_days": number | null,"critical_ack_min": number | null
                      }
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
            "alert_kind": ["TEMP_HIGH", "TEMP_LOW", "OFFLINE", "DOOR_OPEN", "POWER_FAILURE", "COMPRESSOR_FAULT", "HUMIDITY", "CALIBRATION_DUE", "BATTERY_LOW"],"alert_severity": ["WARNING", "CRITICAL"],"alert_status": ["OPEN", "ACKNOWLEDGED", "RESOLVED"],"app_role": ["SUPER_ADMIN", "WAREHOUSE_MANAGER", "STAFF", "CLIENT", "ACCOUNTANT"],"applicant_status": ["APPLIED", "SHORTLISTED", "INTERVIEW", "OFFERED", "JOINED", "REJECTED"],"audit_action": ["INSERT", "UPDATE", "DELETE"],"billing_cycle": ["WEEKLY", "MONTHLY", "ON_DEMAND"],"billing_mode": ["RENT_ONLY", "LABOUR_ONLY", "BOTH"],"booking_status": ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"],"charge_calc": ["FIXED", "PERCENT"],"client_status": ["ACTIVE", "ON_HOLD", "INACTIVE"],"company_kind": ["SENDER", "RECEIVER", "BOTH"],"contract_status": ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"],"correction_status": ["NONE", "PENDING", "APPROVED", "REJECTED"],"dispatch_status": ["REQUESTED", "APPROVED", "REJECTED", "PICKING", "DISPATCHED", "CANCELLED"],"document_status": ["CONFIRMED", "CANCELLED"],"employee_status": ["ACTIVE", "ON_LEAVE", "EXITED"],"equipment_type": ["CHILLER", "COMPRESSOR", "GENERATOR", "FORKLIFT", "RACK", "OTHER"],"gate_direction": ["INWARD", "OUTWARD"],"gate_status": ["AT_GATE", "UNLOADING", "RECEIVED", "LOADING", "DISPATCHED", "CANCELLED"],"invoice_section": ["RENT", "LABOUR", "OTHER"],"invoice_status": ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],"job_role": ["MANAGER", "PICKER", "LOADER", "SECURITY", "ACCOUNTANT"],"labour_activity": ["UNLOADING", "SORTING", "STACKING", "LABELLING", "LOADING", "PICKING", "PACKING"],"labour_basis": ["PER_PACKAGE", "PER_TONNE", "PER_BRIGADE_MOVED", "PER_HOUR", "FLAT_PER_LORRY"],"line_condition": ["GOOD", "DAMAGED", "SHORT"],"movement_type": ["IN", "OUT", "TRANSFER", "ADJUSTMENT"],"note_kind": ["CREDIT", "DEBIT"],"payment_method": ["UPI", "BANK_TRANSFER", "CHEQUE", "CASH", "ONLINE", "DEPOSIT_ADJUSTMENT"],"pick_rule": ["FEFO", "FIFO"],"premium_type": ["NONE", "PERCENT", "AMOUNT"],"rate_scope": ["CLIENT", "GROUP", "WAREHOUSE", "GLOBAL"],"reading_source": ["SENSOR", "MANUAL"],"rent_basis": ["PER_BRIGADE", "PER_M3"],"request_status": ["PENDING", "APPROVED", "REJECTED"],"sensor_status": ["ACTIVE", "OFFLINE", "FAULTY", "RETIRED"],"sensor_type": ["TEMPERATURE", "HUMIDITY", "DOOR", "POWER", "COMPRESSOR"],"slot_status": ["FREE", "RESERVED", "OCCUPIED", "BLOCKED"],"stock_condition": ["GOOD", "DAMAGED"],"storage_type": ["DRY", "CHILLED", "FROZEN", "DEEP_FREEZE", "BONDED", "HAZMAT"],"task_status": ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"],"ticket_status": ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED"],"vacancy_status": ["OPEN", "ON_HOLD", "CLOSED"]
          }
        }
} as const
