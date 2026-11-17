
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_settings": {
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
                },"clients": {
                  Row: {
                    "address_line1": string | null,"address_line2": string | null,"city": string | null,"code": string,"company_name": string,"contact_name": string | null,"created_at": string,"credit_limit_paise": number,"deleted_at": string | null,"district": string | null,"email": string | null,"gstin": string | null,"id": string,"notes": string | null,"pan": string | null,"phone": string | null,"pick_rule": Database["public"]['Enums']["pick_rule"],"pincode": string | null,"state": string | null,"state_code": string | null,"status": Database["public"]['Enums']["client_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"city"?: string | null,"code"?: string,"company_name": string,"contact_name"?: string | null,"created_at"?: string,"credit_limit_paise"?: number,"deleted_at"?: string | null,"district"?: string | null,"email"?: string | null,"gstin"?: string | null,"id"?: string,"notes"?: string | null,"pan"?: string | null,"phone"?: string | null,"pick_rule"?: Database["public"]['Enums']["pick_rule"],"pincode"?: string | null,"state"?: string | null,"state_code"?: string | null,"status"?: Database["public"]['Enums']["client_status"],"updated_at"?: string
                  }
                  Update: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"city"?: string | null,"code"?: string,"company_name"?: string,"contact_name"?: string | null,"created_at"?: string,"credit_limit_paise"?: number,"deleted_at"?: string | null,"district"?: string | null,"email"?: string | null,"gstin"?: string | null,"id"?: string,"notes"?: string | null,"pan"?: string | null,"phone"?: string | null,"pick_rule"?: Database["public"]['Enums']["pick_rule"],"pincode"?: string | null,"state"?: string | null,"state_code"?: string | null,"status"?: Database["public"]['Enums']["client_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
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
      referencedRelation: "warehouses"
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
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_challans": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"challan_no": string,"client_id": string,"confirmed_by": string | null,"created_at": string,"deleted_at": string | null,"dispatch_request_id": string,"dispatch_temp_c": number | null,"dispatched_at": string,"gate_entry_id": string,"id": string,"pod_signed_at": string | null,"receiver_name": string | null,"remarks": string | null,"seal_number": string | null,"signature_path": string | null,"status": Database["public"]['Enums']["document_status"],"to_company_id": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"challan_no": string,"client_id": string,"confirmed_by"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"dispatch_request_id": string,"dispatch_temp_c"?: number | null,"dispatched_at"?: string,"gate_entry_id": string,"id"?: string,"pod_signed_at"?: string | null,"receiver_name"?: string | null,"remarks"?: string | null,"seal_number"?: string | null,"signature_path"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"to_company_id": string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"challan_no"?: string,"client_id"?: string,"confirmed_by"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"dispatch_request_id"?: string,"dispatch_temp_c"?: number | null,"dispatched_at"?: string,"gate_entry_id"?: string,"id"?: string,"pod_signed_at"?: string | null,"receiver_name"?: string | null,"remarks"?: string | null,"seal_number"?: string | null,"signature_path"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"to_company_id"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
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
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"inward_receipts": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"client_id": string,"company_id": string | null,"confirmed_by": string | null,"created_at": string,"deleted_at": string | null,"gate_entry_id": string,"id": string,"receipt_no": string,"received_at": string,"remarks": string | null,"status": Database["public"]['Enums']["document_status"],"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id": string,"company_id"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"gate_entry_id": string,"id"?: string,"receipt_no": string,"received_at"?: string,"remarks"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id"?: string,"company_id"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"gate_entry_id"?: string,"id"?: string,"receipt_no"?: string,"received_at"?: string,"remarks"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
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
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"labour_entries": {
                  Row: {
                    "activity": Database["public"]['Enums']["labour_activity"],"cancelled": boolean,"client_id": string,"created_at": string,"created_by": string | null,"document_id": string,"document_type": string,"hours": number,"id": string,"packages": number,"remarks": string | null,"tonnes": number,"updated_at": string,"warehouse_id": string,"workers": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": Database["public"]['Enums']["labour_activity"],"cancelled"?: boolean,"client_id": string,"created_at"?: string,"created_by"?: string | null,"document_id": string,"document_type": string,"hours": number,"id"?: string,"packages"?: number,"remarks"?: string | null,"tonnes"?: number,"updated_at"?: string,"warehouse_id": string,"workers": number
                  }
                  Update: {
                    "activity"?: Database["public"]['Enums']["labour_activity"],"cancelled"?: boolean,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"document_id"?: string,"document_type"?: string,"hours"?: number,"id"?: string,"packages"?: number,"remarks"?: string | null,"tonnes"?: number,"updated_at"?: string,"warehouse_id"?: string,"workers"?: number
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
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"slot_allocations": {
                  Row: {
                    "brigade_type_id": string,"cancelled": boolean,"client_id": string,"created_at": string,"end_date": string | null,"end_document_id": string | null,"end_document_type": string | null,"id": string,"slot_id": string,"start_date": string,"start_document_id": string | null,"start_document_type": string | null,"updated_at": string,"warehouse_id": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brigade_type_id": string,"cancelled"?: boolean,"client_id": string,"created_at"?: string,"end_date"?: string | null,"end_document_id"?: string | null,"end_document_type"?: string | null,"id"?: string,"slot_id": string,"start_date": string,"start_document_id"?: string | null,"start_document_type"?: string | null,"updated_at"?: string,"warehouse_id": string,"zone_id": string
                  }
                  Update: {
                    "brigade_type_id"?: string,"cancelled"?: boolean,"client_id"?: string,"created_at"?: string,"end_date"?: string | null,"end_document_id"?: string | null,"end_document_type"?: string | null,"id"?: string,"slot_id"?: string,"start_date"?: string,"start_document_id"?: string | null,"start_document_type"?: string | null,"updated_at"?: string,"warehouse_id"?: string,"zone_id"?: string
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
                    "blocked_slots": number | null,"free_slots": number | null,"occupied_slots": number | null,"reserved_slots": number | null,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number | null,"temp_min": number | null,"total_slots": number | null,"warehouse_code": string,"warehouse_id": string,"warehouse_name": string,"zone_code": string,"zone_id": string,"zone_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "adjust_stock":
{ Args: { "p_new_quantity": number,"p_reason": string,"p_stock_item_id": string }; Returns: undefined
                           },
"approve_booking":
{ Args: { "p_booking_id": string,"p_note"?: string }; Returns: number
                           },
"approve_dispatch_request":
{ Args: { "p_note"?: string,"p_request_id": string }; Returns: number
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
"cancel_inward_receipt":
{ Args: { "p_reason": string,"p_receipt_id": string }; Returns: undefined
                           },
"check_space_availability":
{ Args: { "p_brigade_type_id"?: string,"p_setpoint"?: number,"p_storage_type": Database["public"]['Enums']["storage_type"],"p_temp_max"?: number,"p_temp_min"?: number,"p_warehouse_id": string }; Returns: {
              "free_slots": number,"storage_type": Database["public"]['Enums']["storage_type"],"temp_max": number,"temp_min": number,"zone_code": string,"zone_id": string,"zone_name": string
            }[]
                           },
"client_has_active_contract":
{ Args: { "p_client_id": string,"p_on"?: string,"p_warehouse_id": string }; Returns: boolean
                           },
"client_sees_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"company_belongs_to_client":
{ Args: { "p_client_id": string,"p_company_id": string }; Returns: boolean
                           },
"confirm_delivery_challan":
{ Args: { "p_dispatch_temp_c"?: number,"p_gate_entry_id": string,"p_labour"?: Json,"p_receiver_name"?: string,"p_remarks"?: string,"p_request_id": string,"p_seal_number"?: string,"p_signature_path"?: string }; Returns: string
                           },
"confirm_inward_receipt":
{ Args: { "p_gate_entry_id": string,"p_labour"?: Json,"p_lines": Json,"p_placements": Json,"p_remarks"?: string }; Returns: string
                           },
"create_brigade_slots":
{ Args: { "p_aisle_start"?: number,"p_aisles": number,"p_brigade_type_id": string,"p_levels": number,"p_racks": number,"p_slots_per_level"?: number,"p_zone_id": string }; Returns: number
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"current_client_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"financial_year_label":
{ Args: { "p_date": string }; Returns: string
                           },
"is_admin":
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
"manages_warehouse":
{ Args: { "p_warehouse_id": string }; Returns: boolean
                           },
"next_doc_number":
{ Args: { "p_date"?: string,"p_doc_type": string,"p_warehouse_id": string }; Returns: string
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
"path_warehouse_id":
{ Args: { "p_name": string }; Returns: string
                           },
"record_challan_pod":
{ Args: { "p_challan_id": string,"p_receiver_name": string,"p_signature_path": string }; Returns: undefined
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
"reject_booking":
{ Args: { "p_booking_id": string,"p_note": string }; Returns: undefined
                           },
"reject_dispatch_request":
{ Args: { "p_note": string,"p_request_id": string }; Returns: undefined
                           },
"release_slot_if_empty":
{ Args: { "p_doc_id": string,"p_doc_type": string,"p_on": string,"p_slot_id": string }; Returns: undefined
                           },
"slot_load_kg":
{ Args: { "p_slot_id": string }; Returns: number
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
"today_ist":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"transfer_stock":
{ Args: { "p_quantity": number,"p_reason"?: string,"p_stock_item_id": string,"p_to_slot_id": string }; Returns: string
                           },
"zone_matches_temp":
{ Args: { "r_max": number,"r_min": number,"r_set": number,"r_type": Database["public"]['Enums']["storage_type"],"z_max": number,"z_min": number,"z_type": Database["public"]['Enums']["storage_type"] }; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "SUPER_ADMIN"|"WAREHOUSE_MANAGER"|"STAFF"|"CLIENT","applicant_status": "APPLIED"|"INTERVIEW"|"OFFERED"|"JOINED"|"REJECTED","audit_action": "INSERT"|"UPDATE"|"DELETE","booking_status": "REQUESTED"|"APPROVED"|"REJECTED"|"CANCELLED"|"COMPLETED","client_status": "ACTIVE"|"ON_HOLD"|"INACTIVE","company_kind": "SENDER"|"RECEIVER"|"BOTH","contract_status": "DRAFT"|"ACTIVE"|"EXPIRED"|"TERMINATED","dispatch_status": "REQUESTED"|"APPROVED"|"REJECTED"|"PICKING"|"DISPATCHED"|"CANCELLED","document_status": "CONFIRMED"|"CANCELLED","gate_direction": "INWARD"|"OUTWARD","gate_status": "AT_GATE"|"UNLOADING"|"RECEIVED"|"LOADING"|"DISPATCHED"|"CANCELLED","labour_activity": "UNLOADING"|"SORTING"|"STACKING"|"LABELLING"|"LOADING","line_condition": "GOOD"|"DAMAGED"|"SHORT","movement_type": "IN"|"OUT"|"TRANSFER"|"ADJUSTMENT","pick_rule": "FEFO"|"FIFO","slot_status": "FREE"|"RESERVED"|"OCCUPIED"|"BLOCKED","stock_condition": "GOOD"|"DAMAGED","storage_type": "DRY"|"CHILLED"|"FROZEN"|"DEEP_FREEZE"|"BONDED"|"HAZMAT","vacancy_status": "OPEN"|"ON_HOLD"|"CLOSED"
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
            "app_role": ["SUPER_ADMIN", "WAREHOUSE_MANAGER", "STAFF", "CLIENT"],"applicant_status": ["APPLIED", "INTERVIEW", "OFFERED", "JOINED", "REJECTED"],"audit_action": ["INSERT", "UPDATE", "DELETE"],"booking_status": ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"],"client_status": ["ACTIVE", "ON_HOLD", "INACTIVE"],"company_kind": ["SENDER", "RECEIVER", "BOTH"],"contract_status": ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"],"dispatch_status": ["REQUESTED", "APPROVED", "REJECTED", "PICKING", "DISPATCHED", "CANCELLED"],"document_status": ["CONFIRMED", "CANCELLED"],"gate_direction": ["INWARD", "OUTWARD"],"gate_status": ["AT_GATE", "UNLOADING", "RECEIVED", "LOADING", "DISPATCHED", "CANCELLED"],"labour_activity": ["UNLOADING", "SORTING", "STACKING", "LABELLING", "LOADING"],"line_condition": ["GOOD", "DAMAGED", "SHORT"],"movement_type": ["IN", "OUT", "TRANSFER", "ADJUSTMENT"],"pick_rule": ["FEFO", "FIFO"],"slot_status": ["FREE", "RESERVED", "OCCUPIED", "BLOCKED"],"stock_condition": ["GOOD", "DAMAGED"],"storage_type": ["DRY", "CHILLED", "FROZEN", "DEEP_FREEZE", "BONDED", "HAZMAT"],"vacancy_status": ["OPEN", "ON_HOLD", "CLOSED"]
          }
        }
} as const
