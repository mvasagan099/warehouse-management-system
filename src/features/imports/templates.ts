export type ImportKind = 'clients' | 'companies' | 'opening_stock' | 'opening_balances'

/** Columns each import understands. First row of a template file; extra columns are ignored by the server. */
export const IMPORT_COLUMNS: Record<ImportKind, { required: string[]; optional: string[]; example: string[] }> = {
  clients: {
    required: ['company_name'],
    optional: ['gstin', 'pan', 'contact_name', 'phone', 'email', 'address_line1', 'city', 'district', 'state', 'state_code', 'pincode', 'credit_limit_rupees'],
    example: ['Sri Murugan Foods', '33AABCT1332L1ZL', '', 'R. Murugan', '9876543210', 'murugan@example.com', '12 Market Road', 'Madurai', 'Madurai', 'Tamil Nadu', '33', '625001', '200000'],
  },
  companies: {
    required: ['client_code', 'name'],
    optional: ['kind', 'gstin', 'city', 'state', 'state_code', 'pincode', 'contact_name', 'phone', 'email'],
    example: ['C001', 'Hotel Saravana', 'RECEIVER', '', 'Chennai', 'Tamil Nadu', '33', '600001', '', '9876500000', ''],
  },
  opening_stock: {
    required: ['client_code', 'slot_code', 'item_name', 'unit', 'quantity'],
    optional: ['sku', 'batch_no', 'mfg_date', 'expiry_date', 'packages', 'unit_weight_kg', 'storage_type', 'required_temp_c', 'condition'],
    example: ['C001', 'W1-Z2-A1-R1-L1-B01', 'Frozen peas 1 kg', 'BOX', '120', 'PEAS-1', 'B2411', '2026-10-01', '2027-04-01', '120', '12', 'FROZEN', '-20', 'GOOD'],
  },
  opening_balances: { required: ['client_code', 'as_of', 'amount_rupees'], optional: ['notes'], example: ['C001', '2026-11-30', '12500.50', 'Balance brought forward'] },
}

export function templateCsv(kind: ImportKind): string {
  const c = IMPORT_COLUMNS[kind]
  return [[...c.required, ...c.optional].join(','), c.example.join(',')].join('\r\n') + '\r\n'
}

/** Checks a parsed file has the columns the import needs, before anything is sent to the server. */
export function missingColumns(kind: ImportKind, headers: string[]): string[] {
  return IMPORT_COLUMNS[kind].required.filter((c) => !headers.includes(c))
}
