'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProfileFormProps {
  name: string
  email: string
  phone: string | null
}

export function ProfileForm({ name: initialName, email, phone: initialPhone }: ProfileFormProps) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await authFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save')
      } else {
        toast.success('Profile saved')
      }
    } catch {
      toast.error('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={saving}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          value={email}
          disabled
          className="text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">Phone</Label>
        <Input
          id="profile-phone"
          type="tel"
          placeholder="e.g. 555-867-5309"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={saving}
        />
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}
