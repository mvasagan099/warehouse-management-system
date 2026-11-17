import type { Database } from '../types/database'

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']

export type AppRole = Enums<'app_role'>
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

// Enum value lists come from the generated schema constants, not hand-typed copies.
export { Constants } from '../types/database'
