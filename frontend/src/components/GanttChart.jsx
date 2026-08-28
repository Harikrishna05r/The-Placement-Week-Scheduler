import React, { useState, useMemo } from 'react';
import { Search, Clock, CalendarDays, Filter, ChevronRight, User, Building, Shield } from 'lucide-react';

export default function GanttChart({ rooms, slots, assignments, onSelectInterview }) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState('all');

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map = {};
    for (const s of slots) {
      if (!map[s.day]) map[s.day] = [];
      map[s.day].push(s);
    }
    for (const day in map) {
      map[day].sort((a, b) => a.start_min - b.start_min);
    }
    return map;
  }, [slots]);

  const availableDays = useMemo(() => {
    const days = Object.keys(slotsByDay).map(Number).sort((a, b) => a - b);
    return days.length > 0 ? days : [1, 2, 3, 4, 5];
  }, [slotsByDay]);

  const currentSlots = useMemo(() => {
    if (selectedDay === 'all') return slots;
    return slotsByDay[selectedDay] || [];
  }, [selectedDay, slotsByDay, slots]);

  // Index assignments by (room_id, slot_id)
  const assignmentGrid = useMemo(() => {
    const grid = {};
    for (const a of assignments) {
      const key = `${a.room_id}_${a.slot_id}`;
      grid[key] = a;
    }
    return grid;
  }, [assignments]);

  const formatTime = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : h;
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const getTierClass = (priority) => {
    if (priority === 1) return 'tier-1';
    if (priority === 2) return 'tier-2';
    return 'tier-3';
  };

  const filteredAssignmentsCount = useMemo(() => {
    if (!searchQuery && filterTier === 'all') return assignments.length;
    return assignments.filter((a) => {
      const matchSearch =
        !searchQuery ||
        a.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.company_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.student_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTier = filterTier === 'all' || a.priority === Number(filterTier);
      return matchSearch && matchTier;
    }).length;
  }, [assignments, searchQuery, filterTier]);

  return (
    <div className="glass-panel p-5 rounded-2xl shadow-2xl border border-slate-800 mb-6">
      {/* Header controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold font-display text-white tracking-tight">
              Room-by-Time Gantt Timeline
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-indigo-300 border border-indigo-500/20">
              {assignments.length} Total Bookings
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive room allocation matrix. Hover or click an interview card for full panel details.
          </p>
        </div>

        {/* Filters & Day Tabs */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search company / student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Tier Filter */}
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="bg-slate-950/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Tiers</option>
            <option value="1">Tier 1 (Mass / High Priority)</option>
            <option value="2">Tier 2 (Mid Tier)</option>
            <option value="3">Tier 3 (Niche Tier)</option>
          </select>

          {/* Day Selector Pills */}
          <div className="flex items-center bg-slate-950/90 rounded-lg p-1 border border-slate-800">
            {availableDays.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedDay === day
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                Day {day}
              </button>
            ))}
            <button
              onClick={() => setSelectedDay('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedDay === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Full Week
            </button>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 mb-4 px-1">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-300">Priority Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm tier-1 inline-block" />
            <span className="text-slate-300">Tier 1 (Mass / P1)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm tier-2 inline-block" />
            <span className="text-slate-300">Tier 2 (Mid / P2)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm tier-3 inline-block" />
            <span className="text-slate-300">Tier 3 (Niche / P3)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm free-slot border border-slate-700 inline-block" />
            <span className="text-slate-400">Available Room</span>
          </div>
        </div>

        {searchQuery && (
          <span className="text-xs text-indigo-400 font-medium">
            Filtering matching: {filteredAssignmentsCount} interviews
          </span>
        )}
      </div>

      {/* Timeline Scrollable Grid Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[640px] rounded-xl border border-slate-800 bg-slate-950/60 shadow-inner">
        <table className="w-full border-collapse text-left">
          {/* Header row with time slots */}
          <thead>
            <tr>
              <th className="room-cell-header p-3 text-xs font-bold text-slate-300 uppercase tracking-wider min-w-[130px] border-b-2 border-slate-700 bg-slate-900/95">
                Room
              </th>
              {currentSlots.map((slot) => (
                <th
                  key={slot.id}
                  className="slot-cell-header p-2 text-center text-[11px] font-semibold text-slate-400 min-w-[110px] max-w-[130px] border-l border-slate-800/80 bg-slate-900/95"
                >
                  <div className="font-mono text-slate-300 font-bold">{formatTime(slot.start_min)}</div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {selectedDay === 'all' ? `D${slot.day} ` : ''}Slot {slot.id.split('-')[1]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Rows per room */}
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="hover:bg-slate-900/40 transition-colors">
                {/* Sticky room label */}
                <td className="room-cell-header p-3 text-xs font-semibold text-white whitespace-nowrap bg-slate-900/90 shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <div>
                      <div className="font-bold text-slate-200">{room.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{room.id}</div>
                    </div>
                  </div>
                </td>

                {/* Slots in room */}
                {currentSlots.map((slot) => {
                  const key = `${room.id}_${slot.id}`;
                  const booking = assignmentGrid[key];

                  const isHighlighted =
                    booking &&
                    (!searchQuery ||
                      booking.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      booking.company_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      booking.student_id.toLowerCase().includes(searchQuery.toLowerCase())) &&
                    (filterTier === 'all' || booking.priority === Number(filterTier));

                  return (
                    <td
                      key={slot.id}
                      className="p-1 border-l border-b border-slate-800/60 min-w-[110px] max-w-[130px] h-[58px] align-top"
                    >
                      {booking ? (
                        <div
                          onClick={() => onSelectInterview(booking)}
                          className={`interview-slot-block h-full flex flex-col justify-between ${getTierClass(
                            booking.priority
                          )} ${
                            isHighlighted
                              ? 'ring-2 ring-indigo-400/80 shadow-lg'
                              : 'opacity-30 filter grayscale'
                          }`}
                          title={`Click to view: ${booking.company_name} | Student ${booking.student_id} | Panel ${booking.panel_no}`}
                        >
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <span className="font-bold truncate text-[11px]">
                              {booking.company_name || booking.company_id}
                            </span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-black/30 font-mono font-semibold shrink-0">
                              P{booking.panel_no}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-white/90 font-mono">
                            <span className="truncate">{booking.student_id}</span>
                            <span className="text-[9px] opacity-80">{booking.duration_min}m</span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="free-slot h-full flex items-center justify-center text-[10px] text-slate-600 hover:text-slate-400 cursor-default"
                          title="Room is free in this time slot"
                        >
                          <span className="opacity-40 hover:opacity-100 font-mono text-[9px]">+ Free</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
