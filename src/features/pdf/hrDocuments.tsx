import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.5 },
  h1: { fontSize: 16, marginBottom: 4, fontFamily: 'Helvetica-Bold' }, muted: { color: '#64748b', marginBottom: 16 },
  p: { marginBottom: 10 }, sig: { marginTop: 48, flexDirection: 'row', justifyContent: 'space-between' }, line: { borderTopWidth: 1, borderColor: '#334155', width: 180, paddingTop: 4 },
})

export interface OfferLetterData {
  company: string; address?: string; candidate: string; position: string; warehouse: string; joiningDate: string; issuedOn: string
  salaryText?: string | null; signatory: string; terms?: string
}

/** A plain one-page offer letter. The salary line appears only when an administrator typed it in; managers never see salary data. */
export function OfferLetterPdf(d: OfferLetterData) {
  return (
    <Document title={`Offer letter - ${d.candidate}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{d.company}</Text>
        {d.address ? <Text style={s.muted}>{d.address}</Text> : null}
        <Text style={s.p}>Date: {d.issuedOn}</Text>
        <Text style={s.p}>Dear {d.candidate},</Text>
        <Text style={s.p}>We are pleased to offer you the position of {d.position} at our {d.warehouse} warehouse. Your expected date of joining is {d.joiningDate}.</Text>
        {d.salaryText ? <Text style={s.p}>Compensation: {d.salaryText}.</Text> : null}
        <Text style={s.p}>{d.terms ?? 'This offer is subject to verification of your identity documents and to the company policies in force. Please bring your original ID proof on the day of joining.'}</Text>
        <Text style={s.p}>Please sign and return a copy to confirm that you accept this offer.</Text>
        <View style={s.sig}><View><Text style={s.line}>{d.signatory}</Text><Text>For {d.company}</Text></View><View><Text style={s.line}>{d.candidate}</Text><Text>Accepted</Text></View></View>
      </Page>
    </Document>
  )
}
