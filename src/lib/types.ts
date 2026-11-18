import type { Database } from '../types/database'

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']

export type AppRole = Enums<'app_role'>
export type ClientStatus = Enums<'client_status'>
export type PickRule = Enums<'pick_rule'>
export type ContractStatus = Enums<'contract_status'>
export type CompanyKind = Enums<'company_kind'>
export type BookingStatus = Enums<'booking_status'>
export type GateDirection = Enums<'gate_direction'>
export type GateStatus = Enums<'gate_status'>
export type LineCondition = Enums<'line_condition'>
export type DocumentStatus = Enums<'document_status'>
export type MovementType = Enums<'movement_type'>
export type LabourActivity = Enums<'labour_activity'>
export type DispatchStatus = Enums<'dispatch_status'>
export type StorageType = Enums<'storage_type'>
export type SlotStatus = Enums<'slot_status'>
export type ApplicantStatus = Enums<'applicant_status'>
export type VacancyStatus = Enums<'vacancy_status'>

export type Profile = Tables<'profiles'>
export type Warehouse = Tables<'warehouses'>
export type Zone = Tables<'zones'>
export type BrigadeType = Tables<'brigade_types'>
export type BrigadeSlot = Tables<'brigade_slots'>
export type Vacancy = Tables<'vacancies'>
export type Applicant = Tables<'applicants'>
export type AuditLog = Tables<'audit_logs'>
export type ZoneSlotSummary = Views<'v_zone_slot_summary'>

export type Client = Tables<'clients'>
export type Contract = Tables<'contracts'>
export type Company = Tables<'company_master'>
export type SpaceBooking = Tables<'space_bookings'>
export type GateEntry = Tables<'gate_entries'>
export type GateEntryLine = Tables<'gate_entry_lines'>
export type InwardReceipt = Tables<'inward_receipts'>
export type InwardReceiptLine = Tables<'inward_receipt_lines'>
export type StockItem = Tables<'stock_items'>
export type StockMovement = Tables<'stock_movements'>
export type DispatchRequest = Tables<'dispatch_requests'>
export type DispatchRequestLine = Tables<'dispatch_request_lines'>
export type DispatchPick = Tables<'dispatch_picks'>
export type DeliveryChallan = Tables<'delivery_challans'>
export type DeliveryChallanLine = Tables<'delivery_challan_lines'>
export type LabourEntry = Tables<'labour_entries'>

// Enum value lists come from the generated schema constants, not hand-typed copies.
export { Constants } from '../types/database'

// ---- Phase 3: billing ----
export type InvoiceStatus = Enums<'invoice_status'>
export type InvoiceSection = Enums<'invoice_section'>
export type BillingMode = Enums<'billing_mode'>
export type BillingCycle = Enums<'billing_cycle'>
export type RateScope = Enums<'rate_scope'>
export type RentBasis = Enums<'rent_basis'>
export type LabourBasis = Enums<'labour_basis'>
export type PremiumType = Enums<'premium_type'>
export type PaymentMethod = Enums<'payment_method'>
export type NoteKind = Enums<'note_kind'>
export type ChargeCalc = Enums<'charge_calc'>
export type Invoice = Tables<'invoices'>
export type InvoiceLine = Tables<'invoice_lines'>
export type InvoiceTaxLine = Tables<'invoice_tax_lines'>
export type AdjustmentNote = Tables<'adjustment_notes'>
export type Payment = Tables<'payments'>
export type RateCard = Tables<'rate_cards'>
export type RentRate = Tables<'rent_rates'>
export type LabourRate = Tables<'labour_rates'>
export type OtherCharge = Tables<'other_charges'>
export type TaxRule = Tables<'tax_rules'>
export type ClientGroup = Tables<'client_groups'>

// ---- Phase 4: cold chain ----
export type SensorType = Enums<'sensor_type'>
export type SensorStatus = Enums<'sensor_status'>
export type AlertKind = Enums<'alert_kind'>
export type AlertSeverity = Enums<'alert_severity'>
export type AlertStatus = Enums<'alert_status'>
export type EquipmentType = Enums<'equipment_type'>
export type TaskStatus = Enums<'task_status'>
export type Sensor = Tables<'sensors'>
export type DeviceKey = Tables<'device_keys'>
export type CalibrationLog = Tables<'calibration_log'>
export type AlertRule = Tables<'alert_rules'>
export type DefrostWindow = Tables<'defrost_windows'>
export type Alert = Tables<'alerts'>
export type AlertStock = Tables<'alert_stock'>
export type ClientNotice = Tables<'client_notices'>
export type Equipment = Tables<'equipment'>
export type MaintenanceTask = Tables<'maintenance_tasks'>
export type AppNotification = Tables<'notifications'>
