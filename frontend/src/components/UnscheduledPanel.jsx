import React, { useState, useMemo } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Search, Layers, DoorClosed, User, Users } from 'lucide-react';

export default function UnscheduledPanel({ unscheduled = [], searchFilter = '', onSelectInterview }) {
  const [selectedReason, setSelectedReason] = useState('all');
  const [localSearch, setLocalSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const effectiveSearch = searchFilter || localSearch;

  // Group counts by reason
  const reasonCounts = useMemo(() => {
    const counts = { all: unscheduled.length, room_capacity: 0, panel_capacity: 0, student_conflict: 0, other: 0 };
    for (const u of unscheduled) {
      if (u.reason === 'room_capacity') counts.room_capacity += 1;
      else if (u.reason === 'panel_capacity') counts.panel_capacity += 1;
      else if (u.reason === 'student_conflict') counts.student_conflict += 1;
      else counts.other += 1;
    }
    return counts;
  }, [unscheduled]);

  // Filter list
  const filteredList = useMemo(() => {
    return unscheduled.filter((u) => {
      const matchesReason =
        selectedReason === 'all' ||
        (selectedReason === 'other'
          ? !['room_capacity', 'panel_capacity', 'student_conflict'].includes(u.reason)
          : u.reason === selectedReason);

      const matchesSearch =
        !effectiveSearch ||
        (u.company_name?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
          u.company_id?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
          u.student_id?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
          u.interview_id?.toLowerCase().includes(effectiveSearch.toLowerCase()));

      return matchesReason && matchesSearch;
    });
  }, [unscheduled, selectedReason, effectiveSearch]);

  const getReasonBadge = (reason) => {
    switch (reason) {
      case 'room_capacity':
        return { label: 'Room Capacity', class: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'panel_capacity':
        return { label: 'Panel Bottleneck', class: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'student_conflict':
        return { label: 'Student Conflict', class: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: 'Coupled Constraint', class: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm">
      {/* Header (CENTERED) */}
      <div className="pb-4 border-b border-slate-100 text-center flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-2 shadow-xs">
          <AlertCircle className="w-5 h-5" />
        </div>
        
        <h2 className="text-lg font-bold font-display text-slate-900 flex items-center justify-center gap-2 text-center">
          <span>Unscheduled Infeasibility Diagnosis</span>
          <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
            {unscheduled.length} Backlog
          </span>
        </h2>
        
        <p className="text-xs text-slate-500 mt-1 text-center max-w-xl mx-auto">
          Binding constraint diagnosis explaining why specific shortlisted candidates could not be placed in the conflict-free schedule.
        </p>

        <div className="mt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-gradient-secondary text-xs py-1 px-3"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Collapse Backlog</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expand Backlog ({filteredList.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5">
          {/* Reason Filter Buttons (CENTERED) */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4 text-center">
            <button
              onClick={() => setSelectedReason('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedReason === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Diagnoses ({reasonCounts.all})
            </button>

            <button
              onClick={() => setSelectedReason('room_capacity')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedReason === 'room_capacity'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              Room Capacity ({reasonCounts.room_capacity})
            </button>

            <button
              onClick={() => setSelectedReason('panel_capacity')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedReason === 'panel_capacity'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              }`}
            >
              Panel Bottleneck ({reasonCounts.panel_capacity})
            </button>

            <button
              onClick={() => setSelectedReason('student_conflict')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedReason === 'student_conflict'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              Student Conflict ({reasonCounts.student_conflict})
            </button>

            {reasonCounts.other > 0 && (
              <button
                onClick={() => setSelectedReason('other')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  selectedReason === 'other'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                Coupled ({reasonCounts.other})
              </button>
            )}
          </div>

          {/* Diagnostic List Body */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
            {filteredList.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No unscheduled interviews match the selected search or diagnostic filter.
              </div>
            ) : (
              filteredList.map((item) => {
                const badge = getReasonBadge(item.reason);
                return (
                  <div
                    key={item.interview_id}
                    onClick={() => onSelectInterview && onSelectInterview(item)}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {item.interview_id}
                          </span>
                          <span className="font-semibold text-xs text-slate-800">
                            {item.company_name || item.company_id}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.class}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Candidate: <strong>{item.student_id}</strong></span>
                      <span>Tier {item.priority || 2}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
