'use client'

import { Button, Card, CardContent, Input, Label } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Profile, payout, and security." />

      <div className="space-y-6">
        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Profile</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Business name</Label>
                <Input defaultValue="" />
              </div>
              <div>
                <Label className="mb-1.5 block">Email</Label>
                <Input type="email" defaultValue="" />
              </div>
            </div>
            <Button>Save changes</Button>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Payout</h3>
            <div>
              <Label className="mb-1.5 block">Payout wallet (Arc)</Label>
              <Input defaultValue="" placeholder="0x…" />
              <p className="mt-1 text-xs text-muted-foreground">USDC settlements arrive here on every transaction.</p>
            </div>
            <Button>Update</Button>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Security</h3>
            <p className="text-sm text-muted-foreground">
              Two-factor authentication is managed in your Privy account. Live-mode API keys
              require 2FA to be enabled.
            </p>
            <Button variant="outline" asChild>
              <a href="https://privy.io" target="_blank" rel="noreferrer">
                Manage 2FA in Privy →
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
