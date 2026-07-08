import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePinDialog({ flatIndex, flatName, changePin }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError('')
  }

  const submit = () => {
    if (next !== confirm) return setError('New PINs do not match')
    const res = changePin(flatIndex, current, next)
    if (res.ok) {
      reset()
      setOpen(false)
    } else {
      setError(res.msg)
    }
  }

  const digits = (v) => v.replace(/\D/g, '').slice(0, 4)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="h-4 w-4" /> Change PIN
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change PIN</DialogTitle>
          <DialogDescription>
            Update the 4-digit PIN for {flatName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="curPin">Current PIN</Label>
            <Input
              id="curPin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={current}
              onChange={(e) => setCurrent(digits(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPin">New PIN</Label>
            <Input
              id="newPin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={next}
              onChange={(e) => setNext(digits(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confPin">Confirm new PIN</Label>
            <Input
              id="confPin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(digits(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button
            variant="accent"
            className="w-full"
            disabled={current.length !== 4 || next.length !== 4 || confirm.length !== 4}
            onClick={submit}
          >
            Update PIN
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
