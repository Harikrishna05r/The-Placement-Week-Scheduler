import React, { useState, useMemo } from 'react';
import { Search, Info, Check, Filter } from 'lucide-react';

export default function GanttChart({
  rooms = [],
  slots = [],
  assignments = [],
  searchFilter = '',
  onSelectInterview,
}) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [localSearch, setLocalSearch] = useState('');
  const [filterTier, setFilterTier] = useState('all');

  const effectiveSearch = searchFilter || localSearch;

  // Derive unique days
  const availableDays = useMemo(() => {
    const days = Array.from(new Set(slots.map((s) => s.day))).sort((a, b) => a - b);
    return days.length > 0 ? days : [1, 2, 3, 4];
  }, [slots]);

  // Filter slots by selected day
  const filteredSlots = useMemo(() => {
    if (selectedDay === 'all') return slots;
    return slots.filter((s) => s.day === selectedDay);
  }, [slots, selectedDay]);

  // Fast mapping of assignments by (room_id, slot_id)
  const assignmentGrid = useMemo(() => {
    const map = {};
    for (const a of assignments) {
      const key = `${a.room_id}_${a.slot_id}`;
      map[key] = a;
    }
    return map;
  }, [assignments]);

  const formatTime = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hrs >= 12 ? 'PM' : 'AM';
    const displayHrs = hrs > 12 ? hrs - 12 : hrs === 0 ? 12 : hrs;
    const displayMins = mins < 10 ? `0${mins}` : mins;
    return `${displayHrs}:${displayMins} ${period}`;
  };

  const getTierClass = (priority) => {
    if (priority === 1) return 'cell-tier-1';
    if (priority === 3) return 'cell-tier-3';
    return 'cell-tier-2';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm">
      {/* Top Header: Title, Controls, Priority Tier Legend (CENTERED) */}
      <div className="pb-4 border-b border-slate-100 text-center flex flex-col items-center justify-center">
        <h2 className="text-lg font-bold font-display text-slate-900 flex items-center justify-center gap-2 text-center">
          <span>Room-by-Time Gantt Matrix</span>
          <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            {assignments.length} Scheduled
          </span>
        </h2>
        <p className="text-xs text-slate-500 mt-1 text-center max-w-xl mx-auto">
          15-minute slot intervals across 20 parallel interview rooms. Click any booking block to inspect details.
        </p>

        {/* Priority Tier Legend (CENTERED) */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs mt-3">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Legend:</span>
          
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md cell-tier-1 text-[11px] font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Tier 1 (Mass)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md cell-tier-2 text-[11px] font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Tier 2 (Mid)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md cell-tier-3 text-[11px] font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-purple-600" />
            <span>Tier 3 (Niche)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-slate-300 text-slate-500 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            <span>Available Room</span>
          </div>
        </div>
      </div>

      {/* Filter and Day Selector Toolbar (CENTERED) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-4 py-3 border-b border-slate-100">
        {/* Day Selector Pills */}
        <div className="flex items-center justify-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {availableDays.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedDay === day
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day {day}
            </button>
          ))}
          <button
            onClick={() => setSelectedDay('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedDay === 'all'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Days
          </button>
        </div>

        {/* Tier Filter */}
        <div className="flex items-center justify-center gap-2">
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:border-indigo-500 transition-colors"
          >
            <option value="all">All Priority Tiers</option>
            <option value="1">Tier 1 (Mass)</option>
            <option value="2">Tier 2 (Mid)</option>
            <option value="3">Tier 3 (Niche)</option>
          </select>
        </div>
      </div>

      {/* Gantt Grid Table Container */}
      <div className="overflow-x-auto mt-4 border border-slate-200 rounded-xl max-h-[600px] overflow-y-auto">
        <div className="min-w-max">
          {/* Header Row: Room label + Time Slots */}
          <div className="sticky top-0 z-20 flex bg-slate-50 border-b border-slate-200">
            {/* Sticky Room Label Header */}
            <div className="sticky left-0 z-30 w-24 shrink-0 bg-slate-100 border-r border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-center">
              Room
            </div>

            {/* Time Slot Columns */}
            <div className="flex">
              {filteredSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="w-32 shrink-0 border-r border-slate-200 px-2 py-1.5 text-center bg-slate-50"
                >
                  <div className="text-[11px] font-bold font-mono text-slate-800 tabular-nums">
                    {formatTime(slot.start_min)}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">
                    D{slot.day} · {slot.id}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Body Rows: Rooms R01 to R20 */}
          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex border-b border-slate-100 hover:bg-slate-50/40 transition-colors"
            >
              {/* Sticky Room ID Cell */}
              <div className="sticky left-0 z-10 w-24 shrink-0 bg-white border-r border-slate-200 px-3 py-2 flex flex-col justify-center items-center shadow-[1px_0_3px_rgba(0,0,0,0.03)]">
                <span className="font-mono font-bold text-xs text-slate-900">
                  {room.id}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  Cap {room.capacity || 1}
                </span>
              </div>

              {/* Slots for this room */}
              <div className="flex">
                {filteredSlots.map((slot) => {
                  const key = `${room.id}_${slot.id}`;
                  const booking = assignmentGrid[key];

                  // Check search filter match
                  const isMatch =
                    !effectiveSearch ||
                    (booking &&
                      (booking.company_name?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
                        booking.company_id?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
                        booking.student_id?.toLowerCase().includes(effectiveSearch.toLowerCase())));

                  const isTierMatch =
                    filterTier === 'all' ||
                    (booking && String(booking.priority) === filterTier);

                  if (booking) {
                    const tierClass = getTierClass(booking.priority);
                    const opacityClass = isMatch && isTierMatch ? 'opacity-100' : 'opacity-20';

                    return (
                      <div
                        key={slot.id}
                        className="w-32 shrink-0 p-1 border-r border-slate-100 flex items-center justify-center"
                      >
                        <button
                          onClick={() => onSelectInterview(booking)}
                          className={`w-full h-12 rounded-lg p-1.5 text-left transition-all ${tierClass} ${opacityClass} hover:shadow-md hover:scale-[1.03] cursor-pointer flex flex-col justify-between`}
                          title={`Interview: ${booking.interview_id}\nCompany: ${booking.company_name || booking.company_id}\nCandidate: ${booking.student_id}\nPanel: P${booking.panel_no}`}
                        >
                          <div className="flex items-center justify-between gap-1 leading-tight">
                            <span className="font-bold text-[11px] truncate">
                              {booking.company_name || booking.company_id}
                            </span>
                            <span className="text-[9px] font-mono font-bold px-1 rounded bg-white/60 shrink-0">
                              P{booking.panel_no}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono leading-tight">
                            <span className="font-medium opacity-90">{booking.student_id}</span>
                            <span className="text-[9px] opacity-75">{booking.duration_min}m</span>
                          </div>
                        </button>
                      </div>
                    );
                  }

                  // Empty Slot (Free Room)
                  return (
                    <div
                      key={slot.id}
                      className="w-32 shrink-0 p-1 border-r border-slate-100 flex items-center justify-center"
                    >
                      <div className="w-full h-12 rounded-lg cell-free-room flex items-center justify-center text-[10px] font-medium select-none">
                        <span>+ Free</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
