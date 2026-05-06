'use client'

import * as React from 'react'
import { ExternalLink, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button, Badge, Card, CardContent, Input, Label, Switch, Textarea,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Account, business, payout, notifications, and team."
      />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="payout">Payout</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <SettingsCard title="Profile" description="Identity that shows up in your dashboard.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" id="full-name" defaultValue="Alex Founder" />
              <Field label="Email" id="email" type="email" defaultValue="founder@strimz.finance" />
            </div>
            <Field label="Headline" id="headline" defaultValue="Founder + technical lead" />
            <SaveBar />
          </SettingsCard>

          <SettingsCard title="Security" description="Two-factor authentication is enforced by Privy.">
            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div className="text-sm">
                <div className="font-medium">2FA enabled</div>
                <div className="text-xs text-muted-foreground">Required to issue or rotate live-mode keys.</div>
              </div>
              <Badge variant="outline" className="border-[#02C76A]/40 bg-[#02C76A]/10 text-[#02C76A]">Active</Badge>
            </div>
            <Button variant="outline" asChild>
              <a href="https://privy.io" target="_blank" rel="noreferrer">
                Manage 2FA in Privy <ExternalLink className="ml-1.5 size-3.5" />
              </a>
            </Button>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="business" className="mt-4 space-y-4">
          <SettingsCard title="Business" description="We use these on invoices, payout receipts, and your business verification.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal business name" id="biz-name" defaultValue="Strimz Labs Ltd." />
              <Field label="Trading name" id="biz-trading" defaultValue="Strimz" />
              <Field label="Country of incorporation" id="biz-country" defaultValue="United Kingdom" />
              <Field label="Tax ID / VAT" id="biz-tax" defaultValue="GB-1234567" />
            </div>
            <Field label="Registered address" id="biz-addr" defaultValue="20 Chancery Lane, London, EC4A 1LF" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="biz-sector">Sector</Label>
                <Select defaultValue="saas">
                  <SelectTrigger id="biz-sector"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saas">SaaS / software</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="marketplace">Marketplace</SelectItem>
                    <SelectItem value="services">Professional services</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="biz-mode">Live-mode eligibility</Label>
                <div className="flex items-center gap-2 rounded-md border border-[#02C76A]/40 bg-[#02C76A]/10 px-3 py-2 text-sm">
                  <span className="inline-block size-2 rounded-full bg-[#02C76A]" />
                  <span>Live mode unlocked</span>
                </div>
              </div>
            </div>
            <SaveBar />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="payout" className="mt-4 space-y-4">
          <SettingsCard title="Payout wallet" description="USDC lands in this wallet whenever a customer pays you. Changing it requires an on-chain confirmation.">
            <div className="grid gap-1.5">
              <Label htmlFor="payout-wallet">Payout wallet (Arc)</Label>
              <Input id="payout-wallet" defaultValue="0x742d35Cc6634C0532925a3b844Bc9e7595f8b1A2" className="font-mono" />
              <p className="text-xs text-muted-foreground">Changes require an on-chain transaction.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="payout-currency">Settlement currency</Label>
              <Select defaultValue="USDC">
                <SelectTrigger id="payout-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="EURC">EURC</SelectItem>
                  <SelectItem value="USYC">USYC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SaveBar />
          </SettingsCard>

          <SettingsCard title="Fees" description="A fee is taken on each transaction, in the same payment. There's no separate invoice.">
            <div className="rounded-md border border-border/60 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Current tier</span>
                <Badge>Starter — 0.5%</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Process &gt; $50k / mo and you'll be auto-upgraded to Growth (0.4%).
              </p>
            </div>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <SettingsCard title="Email notifications" description="Pick what shows up in your inbox.">
            <ToggleRow id="notif-digest" label="Daily cashflow digest" desc="Yesterday's gross, fees, net, customers." defaultChecked />
            <ToggleRow id="notif-anomaly" label="Cashflow anomaly alerts" desc="When hourly revenue drops > 2σ from baseline." defaultChecked />
            <ToggleRow id="notif-failed" label="Subscription charge failed" desc="One per failed charge." defaultChecked />
            <ToggleRow id="notif-webhook" label="Webhook endpoint disabled" desc="Auto-fired after 5+ permanent failures." defaultChecked />
            <ToggleRow id="notif-monthly" label="Monthly pricing intelligence" desc="MRR, churn, 90-day forecast on the 1st of each month." defaultChecked />
            <ToggleRow id="notif-product" label="Product updates" desc="New features, breaking changes." />
            <SaveBar />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="team" className="mt-4 space-y-4">
          <SettingsCard title="Team" description="Invite teammates with scoped roles.">
            <div className="space-y-2">
              {[
                { name: 'Alex Founder', email: 'founder@strimz.finance', role: 'Owner' },
                { name: 'Maya Patel', email: 'maya@strimz.finance', role: 'Admin' },
                { name: 'Data worker', email: 'data@strimz.finance', role: 'Read-only' },
              ].map((m) => (
                <div key={m.email} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="shadow-sub-icon flex size-8 items-center justify-center rounded-full bg-[#02C76A]/10 text-xs font-semibold text-[#02C76A]">
                      {m.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                    <div className="text-sm">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </div>
                  </div>
                  <Badge variant="outline">{m.role}</Badge>
                </div>
              ))}
            </div>
            <div className="grid gap-3 rounded-md border border-dashed border-border/60 p-4 sm:grid-cols-[1fr_140px_120px]">
              <Input placeholder="email@your-team.com" className="h-9" />
              <Select defaultValue="admin">
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="readonly">Read-only</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => toast.success('Invite sent')}>Invite</Button>
            </div>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-4">
          <SettingsCard title="Plan" description="Fees are taken on each transaction. There's no monthly bill to pay.">
            <div className="rounded-md border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Starter</div>
                  <div className="text-xs text-muted-foreground">0.5% per transaction · up to $50k / mo</div>
                </div>
                <Badge variant="outline" className="border-[#02C76A]/40 bg-[#02C76A]/10 text-[#02C76A]">Current</Badge>
              </div>
            </div>
            <Button variant="outline">Compare plans</Button>
          </SettingsCard>

          <SettingsCard title="Danger zone" description="Deleting your account is permanent. Your live data, keys, and webhook endpoints will all be removed.">
            <Textarea
              rows={2}
              placeholder="Type DELETE to confirm"
              className="resize-none"
            />
            <Button variant="outline" className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10">
              Delete account
            </Button>
          </SettingsCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SettingsCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sub-card border-border/60">
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="font-sora text-base font-semibold">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function Field({ label, id, type = 'text', defaultValue }: { label: string; id: string; type?: string; defaultValue?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} defaultValue={defaultValue} className="h-9" />
    </div>
  )
}

function ToggleRow({ id, label, desc, defaultChecked }: { id: string; label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
      <div className="text-sm">
        <Label htmlFor={id} className="font-medium">{label}</Label>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch id={id} defaultChecked={defaultChecked} />
    </div>
  )
}

function SaveBar() {
  return (
    <div className="flex justify-end">
      <Button onClick={() => toast.success('Settings saved')}>
        <Save className="mr-1.5 size-4" /> Save changes
      </Button>
    </div>
  )
}
