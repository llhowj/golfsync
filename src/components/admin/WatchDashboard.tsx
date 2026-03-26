'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddTeeTimeDialog } from '@/components/admin/AddTeeTimeDialog'
import { WatchDialog } from '@/components/admin/WatchDialog'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Watch {
  id: string
  days_of_week: number[]
  earliest_time: string
  latest_time: string
  min_slots: number
  mode: string
  repeat: boolean
  is_active: boolean
  created_at: string
}

interface WatchAlert {
  id: string
  watch_id: string
  scraped_date: string
  scraped_time: string
  scraped_course: string
  available_slots: number
  status: 'pending' | 'gone' | 'booked'
  first_seen_at: string
}

interface WatchDashboardProps {
  groupId: string
  homeCourse: string
  hasPhone: boolean
}

function formatTime(timeStr: string): string {
  const [hourStr, minuteStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minuteStr} ${ampm}`
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function WatchDashboard({ groupId, homeCourse, hasPhone: initialHasPhone }: WatchDashboardProps) {
  const [watches, setWatches] = useState<Watch[]>([])
  const [alerts, setAlerts] = useState<WatchAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [hasPhone, setHasPhone] = useState(initialHasPhone)

  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [editingWatch, setEditingWatch] = useState<Watch | null>(null)
  const [deletingWatchId, setDeletingWatchId] = useState<string | null>(null)
  const [togglingWatchId, setTogglingWatchId] = useState<string | null>(null)

  // Add tee time from alert
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [prefillAlert, setPrefillAlert] = useState<WatchAlert | null>(null)

  // Phone prompt
  const [phoneInput, setPhoneInput] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [watchesRes, alertsRes] = await Promise.all([
      authFetch(`/api/watches?groupId=${groupId}`).then(r => r.json()),
      authFetch(`/api/watch-alerts?groupId=${groupId}`).then(r => r.json()),
    ])
    setWatches(watchesRes.watches ?? [])
    setAlerts(alertsRes.alerts ?? [])
    setLoading(false)
  }, [groupId])

  useEffect(() => { fetchData() }, [fetchData])

  async function savePhone() {
    setPhoneError(null)
    const cleaned = phoneInput.replace(/\D/g, '')
    if (cleaned.length < 10) { setPhoneError('Enter a valid US phone number.'); return }
    const formatted = `+1${cleaned.slice(-10)}`
    setSavingPhone(true)
    try {
      const res = await authFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted }),
      })
      if (!res.ok) { setPhoneError('Failed to save phone number.'); return }
      setHasPhone(true)
      toast.success('Phone number saved.')
    } finally {
      setSavingPhone(false)
    }
  }

  async function toggleActive(watch: Watch) {
    setTogglingWatchId(watch.id)
    try {
      await authFetch(`/api/watches/${watch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !watch.is_active }),
      })
      fetchData()
    } finally {
      setTogglingWatchId(null)
    }
  }

  async function deleteWatch(id: string) {
    setDeletingWatchId(id)
    try {
      await authFetch(`/api/watches/${id}`, { method: 'DELETE' })
      toast.success('Watch deleted.')
      fetchData()
    } finally {
      setDeletingWatchId(null)
    }
  }

  function openAddFromAlert(alert: WatchAlert) {
    setPrefillAlert(alert)
    setAddDialogOpen(true)
  }

  async function handleAddSuccess(teeTimeId: string) {
    setAddDialogOpen(false)
    if (prefillAlert && teeTimeId) {
      await authFetch(`/api/watch-alerts/${prefillAlert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'booked', teeTimeId }),
      })
      toast.success('Tee time added and alert marked as booked.')
    }
    setPrefillAlert(null)
    fetchData()
  }

  const pendingAlerts = alerts.filter(a => a.status === 'pending')
  const recentAlerts = alerts.filter(a => a.status !== 'pending').slice(0, 10)

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-8">
      {/* Phone number gate */}
      {!hasPhone && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
          <p className="text-sm font-medium text-amber-800">A phone number is required to receive tee time alerts.</p>
          {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
          <div className="flex gap-2 items-center">
            <input
              type="tel"
              placeholder="(555) 555-5555"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={savingPhone}
            />
            <Button size="sm" onClick={savePhone} disabled={savingPhone}>
              {savingPhone ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {pendingAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Active Alerts</h2>
          <div className="space-y-2">
            {pendingAlerts.map(alert => (
              <div key={alert.id} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-green-900">
                    {formatDate(alert.scraped_date)} at {formatTime(alert.scraped_time)}
                  </p>
                  <p className="text-xs text-green-700">
                    {alert.scraped_course} &bull; {alert.available_slots} slot{alert.available_slots !== 1 ? 's' : ''} open
                  </p>
                </div>
                <Button size="sm" onClick={() => openAddFromAlert(alert)}>
                  Add this tee time →
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watches */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Active Watches</h2>
          <Button
            size="sm"
            onClick={() => { setEditingWatch(null); setWatchDialogOpen(true) }}
            disabled={!hasPhone}
          >
            + New Watch
          </Button>
        </div>

        {watches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No watches yet. Create one and you&apos;ll get a text when a matching tee time opens up.
          </p>
        ) : (
          <div className="space-y-2">
            {watches.map(watch => (
              <div key={watch.id} className={`rounded-lg border px-3 py-2.5 space-y-1 ${watch.is_active ? 'border-border' : 'border-border opacity-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {watch.days_of_week.sort().map(d => DAYS[d]).join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(watch.earliest_time)} – {formatTime(watch.latest_time)} &bull; {watch.min_slots}+ slots &bull; {watch.repeat ? 'Repeating' : 'One-time'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={watch.is_active ? 'default' : 'secondary'} className="text-xs">
                      {watch.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(watch)}
                    disabled={togglingWatchId === watch.id}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {watch.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingWatch(watch); setWatchDialogOpen(true) }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWatch(watch.id)}
                    disabled={deletingWatchId === watch.id}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent alert history */}
      {recentAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground">Recent Alert History</h2>
          <div className="space-y-1.5">
            {recentAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between text-sm px-1">
                <span className="text-muted-foreground">
                  {formatDate(alert.scraped_date)} {formatTime(alert.scraped_time)} — {alert.scraped_course}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    alert.status === 'booked' ? 'border-green-400 text-green-700' : 'border-red-300 text-red-600'
                  }`}
                >
                  {alert.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <WatchDialog
        groupId={groupId}
        open={watchDialogOpen}
        onOpenChange={setWatchDialogOpen}
        onSaved={fetchData}
        existing={editingWatch}
      />

      <AddTeeTimeDialog
        groupId={groupId}
        homeCourse={homeCourse}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleAddSuccess}
        prefillDate={prefillAlert?.scraped_date}
        prefillTime={prefillAlert?.scraped_time}
        prefillCourse={prefillAlert?.scraped_course}
      />
    </div>
  )
}
