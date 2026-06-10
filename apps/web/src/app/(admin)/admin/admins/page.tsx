'use client'

import * as React from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { relativeTime } from '@/lib/format'
import type { AdminRole } from '@/lib/admin-api'
import {
  useAdminList,
  useAdminMe,
  useInviteAdmin,
  useRemoveAdmin,
  useSetAdminRole,
  useSetAdminStatus,
} from '@/hooks/admin'

const ROLES: AdminRole[] = ['super_admin', 'admin', 'read_only']

const ROLE_TINT: Record<AdminRole, string> = {
  super_admin: 'border-[#02C76A]/40 bg-[#02C76A]/10 text-[#02C76A]',
  admin: 'border-sky-400/40 bg-sky-50 text-sky-700',
  read_only: 'border-border/60',
}

/**
 * Admin user management. Only super_admins can invite, change roles,
 * or suspend other admins. Other roles see the list but lose the
 * row-action menu.
 */
export default function AdminAdminsPage() {
  const meQuery = useAdminMe()
  const listQuery = useAdminList()

  const me = meQuery.data
  const isSuper = me?.role === 'super_admin'
  const admins = listQuery.data?.data ?? []

  const removeMutation = useRemoveAdmin()
  const roleMutation = useSetAdminRole()
  const statusMutation = useSetAdminStatus()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin users"
        description="Strimz operators with access to /admin. Roles gate what each one can do."
        action={isSuper ? <InviteAdminDialog /> : null}
      />

      {!isSuper ? (
        <Card className="border-border/60">
          <CardContent className="p-4 text-xs">
            You can see the admin list, but only <strong>super_admin</strong> roles can manage it.
          </CardContent>
        </Card>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-border/60 bg-muted/30 h-16 animate-pulse rounded-xl border"
            />
          ))}
        </div>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="text-muted-foreground border-border/60 grid grid-cols-12 gap-2 border-b px-4 py-2 text-[11px] uppercase tracking-wide">
              <div className="col-span-4">Admin</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Last login</div>
              <div className="col-span-2 text-right">Invited</div>
            </div>
            <div className="divide-y">
              {admins.map((a) => (
                <div
                  key={a.id}
                  className="hover:bg-muted/30 grid grid-cols-12 items-center gap-2 px-4 py-3"
                >
                  <div className="col-span-4">
                    <div className="text-sm font-medium">{a.name ?? a.email}</div>
                    <div className="text-muted-foreground text-xs">{a.email}</div>
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[10px] capitalize ${ROLE_TINT[a.role]}`}
                    >
                      {a.role.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="outline" className="capitalize">
                      {a.status}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-xs">
                    {a.lastLoginAt ? relativeTime(a.lastLoginAt) : 'never'}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-muted-foreground text-xs">
                      {relativeTime(a.invitedAt)}
                    </span>
                    {isSuper && a.id !== me?.id ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="size-7 p-0">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Role</DropdownMenuLabel>
                          {ROLES.filter((r) => r !== a.role).map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => roleMutation.mutate({ id: a.id, input: { role: r } })}
                              className="capitalize"
                            >
                              Set to {r.replace('_', ' ')}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          {a.status === 'active' ? (
                            <DropdownMenuItem
                              onClick={() =>
                                statusMutation.mutate({
                                  id: a.id,
                                  input: { status: 'suspended' },
                                })
                              }
                            >
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                statusMutation.mutate({
                                  id: a.id,
                                  input: { status: 'active' },
                                })
                              }
                            >
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600"
                            onClick={() => removeMutation.mutate(a.id)}
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InviteAdminDialog() {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState<AdminRole>('admin')

  const invite = useInviteAdmin()

  const reset = () => {
    setEmail('')
    setName('')
    setRole('admin')
  }

  const onSubmit = () => {
    if (!email) {
      toast.error('Email is required')
      return
    }
    invite.mutate(
      { email, name: name || undefined, role },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" /> Invite admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite admin</DialogTitle>
          <DialogDescription>
            The invitee signs in with the same email through Privy; their `AdminUser` row claims
            their Privy account automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="adm-email">Email</Label>
            <Input
              id="adm-email"
              type="email"
              placeholder="alice@strimz.finance"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-name">Name (optional)</Label>
            <Input
              id="adm-name"
              placeholder="Alice Chen"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adm-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
              <SelectTrigger id="adm-role" className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={invite.isPending || !email}>
            {invite.isPending ? 'Inviting…' : 'Invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
