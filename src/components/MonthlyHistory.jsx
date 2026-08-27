import { CalendarRange } from 'lucide-react'
import { currentMonthKey, kwh, naira } from '@/lib/constants'
import { cn } from '@/lib/utils'

// Per-flat monthly consumption, read from flats/<id>/monthly/<YYYY-MM> in
// Realtime Database. Nothing is derived or back-filled: months the device has
// not published simply are not listed.
export default function MonthlyHistory({ rows = [], compact = false }) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
        <CalendarRange className="h-7 w-7 opacity-50" />
        <p className="text-sm">No monthly records yet</p>
        <p className="max-w-xs text-xs">
          Each month’s usage appears here once the meter publishes it.
        </p>
      </div>
    )
  }

  const thisMonth = currentMonthKey()
  const totalEnergy = rows.reduce((s, r) => s + r.energyKWh, 0)
  const totalBilled = rows.reduce((s, r) => s + r.billed, 0)
  const anyRecharged = rows.some((r) => r.recharged != null)
  // Only worth a column once some debt has actually been repaid — otherwise it
  // is a column of zeros. Note nothing here derives "credit received" from
  // recharged minus repaid: months predating the firmware's `repaid` counter
  // report 0 while their `recharged` may still include repayment, so that
  // subtraction would be wrong for exactly the rows a landlord cares about.
  const anyRepaid = rows.some((r) => r.repaid > 0)
  const totalRepaid = rows.reduce((s, r) => s + (r.repaid || 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Month</th>
            <th className="py-2 pr-3 text-right font-semibold">Consumed</th>
            <th className="py-2 pr-3 text-right font-semibold">Billed</th>
            {anyRecharged && (
              <th className="py-2 pr-3 text-right font-semibold">Recharged</th>
            )}
            {anyRepaid && (
              <th className="py-2 text-right font-semibold">Repaid</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2.5 pr-3">
                <span className="font-medium">{r.label}</span>
                {r.key === thisMonth && (
                  <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    so far
                  </span>
                )}
              </td>
              <td className="num py-2.5 pr-3 text-right font-semibold">
                {kwh(r.energyKWh, 2)}
              </td>
              <td className="num py-2.5 pr-3 text-right">{naira(r.billed, 0)}</td>
              {anyRecharged && (
                <td className="num py-2.5 pr-3 text-right text-muted-foreground">
                  {r.recharged == null ? '—' : naira(r.recharged, 0)}
                </td>
              )}
              {anyRepaid && (
                <td
                  className="num py-2.5 text-right text-muted-foreground"
                  title="Part of the amount recharged that repaid emergency credit instead of becoming spendable balance."
                >
                  {r.repaid == null ? '—' : r.repaid > 0 ? naira(r.repaid, 0) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {!compact && rows.length > 1 && (
          <tfoot>
            <tr className={cn('border-t-2 text-xs')}>
              <td className="py-2.5 pr-3 font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </td>
              <td className="num py-2.5 pr-3 text-right font-bold">
                {kwh(totalEnergy, 2)}
              </td>
              <td className="num py-2.5 pr-3 text-right font-bold">
                {naira(totalBilled, 0)}
              </td>
              {anyRecharged && <td className="num py-2.5 pr-3 text-right font-bold" />}
              {anyRepaid && (
                <td className="num py-2.5 text-right font-bold">
                  {naira(totalRepaid, 0)}
                </td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
