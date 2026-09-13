import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { rideService } from '../../services/rideService'

export interface RidexCalendarProps {
  origin?: string
  destination?: string
  selectedDate?: string
  onSelectDate: (date: string) => void
  className?: string
}

export const RidexCalendar: React.FC<RidexCalendarProps> = ({
  origin,
  destination,
  selectedDate,
  onSelectDate,
  className = '',
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)

  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    let isMounted = true

    if (!origin || !destination || origin.trim() === destination.trim()) {
      return
    }

    const fetchAvailability = async () => {
      setIsLoading(true)
      try {
        const res = await rideService.getAvailableDates(origin, destination, monthKey)
        if (isMounted && res?.dates) {
          setAvailableDates(new Set(res.dates))
        }
      } catch {
        if (isMounted) {
          setAvailableDates(new Set())
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchAvailability()
    return () => {
      isMounted = false
    }
  }, [origin, destination, monthKey])

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysCount = new Date(year, month + 1, 0).getDate()

    const days: Array<{ dayNumber: number; dateString: string; isCurrentMonth: boolean }> = []

    // Padding for first day
    for (let i = 0; i < firstDay; i++) {
      days.push({ dayNumber: 0, dateString: '', isCurrentMonth: false })
    }

    for (let d = 1; d <= daysCount; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ dayNumber: d, dateString, isCurrentMonth: true })
    }

    return days
  }, [currentMonth])

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const monthName = currentMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-800 capitalize flex items-center gap-2">
          <span>{monthName}</span>
          {isLoading && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {daysInMonth.map((day, idx) => {
          if (!day.isCurrentMonth) {
            return <div key={`empty-${idx}`} className="h-9" />
          }

          const isSelected = selectedDate === day.dateString
          const isToday = todayStr === day.dateString
          const hasRides = availableDates.has(day.dateString)
          const isPast = day.dateString < todayStr

          return (
            <button
              key={day.dateString}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(day.dateString)}
              className={`h-9 rounded-xl flex flex-col items-center justify-center relative font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isSelected
                  ? 'bg-slate-900 text-white font-bold shadow-sm'
                  : hasRides
                  ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold'
                  : 'hover:bg-slate-100 text-slate-700'
              } ${isToday && !isSelected ? 'ring-1 ring-emerald-400' : ''}`}
            >
              <span>{day.dayNumber}</span>
              {hasRides && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-emerald-600 absolute bottom-1" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      {availableDates.size > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Available Rides</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full ring-1 ring-emerald-400" />
            <span>Today</span>
          </div>
        </div>
      )}
    </div>
  )
}

