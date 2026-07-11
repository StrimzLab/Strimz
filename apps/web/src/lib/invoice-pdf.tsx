'use client'

import * as React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { Invoice, Merchant } from '@strimz/shared-types'

import { tokenAmountToNumber } from './format'

// Use Helvetica — ships with react-pdf, no external fetch. Guarantees
// PDFs render even when Google Fonts is blocked or offline.
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#050020',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  brand: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#050020' },
  brandSub: { fontSize: 10, color: '#58556A', marginTop: 4 },
  invoiceLabel: { textAlign: 'right' },
  invoiceLabelTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  invoiceLabelNumber: { fontSize: 11, color: '#58556A', marginTop: 4 },
  metaGrid: { flexDirection: 'row', marginBottom: 24 },
  metaCol: { flex: 1 },
  metaLabel: {
    fontSize: 9,
    color: '#8B8896',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metaValue: { fontSize: 11, color: '#050020' },
  metaLine: { fontSize: 10, color: '#58556A', marginTop: 2 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colUnit: { flex: 1.5, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  tableHeaderCell: {
    fontSize: 9,
    color: '#8B8896',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  totalsBlock: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  totalsRow: { flexDirection: 'row', paddingVertical: 3, width: 220 },
  totalsLabel: { flex: 1, color: '#58556A' },
  totalsValue: { flex: 1, textAlign: 'right' },
  totalsGrand: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 6,
    paddingTop: 8,
  },
  note: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    color: '#58556A',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#8B8896',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  statusPill: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
})

interface Props {
  invoice: Invoice
  merchant: Pick<Merchant, 'businessName' | 'email' | 'websiteUrl'> | null
}

export function InvoicePdfDocument({ invoice, merchant }: Props) {
  const businessName = merchant?.businessName || 'Merchant'
  const businessEmail = merchant?.email ?? ''
  const businessUrl = merchant?.websiteUrl ?? ''

  const subtotalNum = tokenAmountToNumber(invoice.subtotal)
  const totalNum = tokenAmountToNumber(invoice.total)

  const statusColor: Record<string, { bg: string; fg: string }> = {
    paid: { bg: '#DCFCE7', fg: '#166534' },
    sent: { bg: '#DBEAFE', fg: '#1E40AF' },
    draft: { bg: '#F3F4F6', fg: '#374151' },
    overdue: { bg: '#FEE2E2', fg: '#991B1B' },
    void: { bg: '#F3F4F6', fg: '#6B7280' },
  }
  const tone = statusColor[invoice.status] ?? statusColor.draft!

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{businessName}</Text>
            {businessEmail ? <Text style={styles.brandSub}>{businessEmail}</Text> : null}
            {businessUrl ? <Text style={styles.brandSub}>{businessUrl}</Text> : null}
          </View>
          <View style={styles.invoiceLabel}>
            <Text style={styles.invoiceLabelTitle}>Invoice</Text>
            <Text style={styles.invoiceLabelNumber}>#{invoice.number}</Text>
            <Text style={[styles.statusPill, { backgroundColor: tone.bg, color: tone.fg }]}>
              {invoice.status}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Billed to</Text>
            <Text style={styles.metaValue}>{invoice.customerName ?? 'Customer'}</Text>
            {invoice.customerEmail ? (
              <Text style={styles.metaLine}>{invoice.customerEmail}</Text>
            ) : null}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Issued</Text>
            <Text style={styles.metaValue}>{new Date(invoice.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.metaLabel}>Due</Text>
            <Text style={styles.metaValue}>{new Date(invoice.dueAt).toLocaleDateString()}</Text>
            {invoice.paidAt ? (
              <>
                <Text style={styles.metaLabel}>Paid</Text>
                <Text style={styles.metaValue}>
                  {new Date(invoice.paidAt).toLocaleDateString()}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.tableHeaderCell]}>Description</Text>
          <Text style={[styles.colQty, styles.tableHeaderCell]}>Qty</Text>
          <Text style={[styles.colUnit, styles.tableHeaderCell]}>Unit price</Text>
          <Text style={[styles.colTotal, styles.tableHeaderCell]}>Amount</Text>
        </View>
        {invoice.lineItems.map((li, idx) => {
          const unit = tokenAmountToNumber(li.unitAmount)
          const amount = unit * li.quantity
          return (
            <View style={styles.tableRow} key={idx}>
              <Text style={styles.colDesc}>{li.description}</Text>
              <Text style={styles.colQty}>{li.quantity}</Text>
              <Text style={styles.colUnit}>
                {unit.toLocaleString(undefined, { maximumFractionDigits: 2 })} {invoice.currency}
              </Text>
              <Text style={styles.colTotal}>
                {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {invoice.currency}
              </Text>
            </View>
          )
        })}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>
              {subtotalNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              {invoice.currency}
            </Text>
          </View>
          <View style={[styles.totalsRow, styles.totalsGrand]}>
            <Text style={styles.totalsLabel}>Total due</Text>
            <Text style={styles.totalsValue}>
              {totalNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} {invoice.currency}
            </Text>
          </View>
        </View>

        {invoice.note ? <Text style={styles.note}>{invoice.note}</Text> : null}

        <Text style={styles.footer}>
          Powered by Strimz · Settled on-chain in {invoice.currency} on Arc
        </Text>
      </Page>
    </Document>
  )
}

export async function downloadInvoicePdf(
  invoice: Invoice,
  merchant: Pick<Merchant, 'businessName' | 'email' | 'websiteUrl'> | null,
): Promise<void> {
  const blob = await pdf(<InvoicePdfDocument invoice={invoice} merchant={merchant} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoice-${invoice.number}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
