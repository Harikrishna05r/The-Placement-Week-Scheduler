import React, { useState, useMemo } from 'react';
import { AlertCircle, Search, Filter, HelpCircle, Users, Building, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

export default function UnscheduledPanel({ unscheduled, onSelectInterview }) {
  const [search, setSearch] = useState('');
  const [selectedReason, setSelectedReason] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const reasonStats = useMemo(() => {
    const counts = { all: unscheduled.length, room_capacity: 0, panel_capacity: 0, student_conflict: 0, unknown: 0 };
    for (const u of unscheduled) {
      const r = u.reason || 'unknown';
      if (counts[r] !== undefined) {
        counts[r]++;
      } else {
        counts.unknown++;
      }
    }
    return counts;
  }, [unscheduled]);

  const filteredList = useMemo(() => {
    return unscheduled.filter((u) => {
      const matchSearch =
        !search ||
        u.interview_id.toLowerCase().includes(search.toLowerCase()) ||
        u.company_name.toLowerCase().includes(search.toLowerCase()) ||
        u.company_id.toLowerCase().includes(search.toLowerCase()) ||
        u.student_id.toLowerCase().includes(search.toLowerCase()) ||
        (u.detail && u.detail.toLowerCase().includes(search.toLowerCase()));

      const matchReason = selectedReason === 'all' || u.reason === selectedReason;
      return matchSearch && matchReason;
    });
  }, [unscheduled, search, selectedReason]);

  const getReasonBadge = (reason) => {
    switch (reason) {
      case 'room_capacity':
        return {
          label: 'Room Capacity',
          classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'panel_capacity':
        return {
          label: 'Panel Bottleneck',
          classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        };
      case 'student_conflict':
        return {
          label: 'Student Conflict',
          classes: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
      default:
        return {
          label: 'Coupled Constraint',
          classes: 'bg-slate-700/40 text-slate-300 border-slate-600/30',
        };
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl shadow-2xl border border-slate-800 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold font-display text-white">
              Unscheduled Interviews & Infeasibility Diagnosis
            </h3>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {unscheduled.length} Unplaced
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Root-cause breakdown of why specific shortlisted interviews could not be placed by CP-SAT.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search reason, student, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Filter Tabs by Diagnostic Reason */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setSelectedReason('all')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
            selectedReason === 'all'
              ? 'bg-slate-800 text-white border-indigo-500/50 shadow'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          All ({reasonStats.all})
        </button>

        <button
          onClick={() => setSelectedReason('room_capacity')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
            selectedReason === 'room_capacity'
              ? 'bg-amber-500/20 text-amber-200 border-amber-500/60 shadow'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-amber-300'
          }`}
        >
          Room Capacity ({reasonStats.room_capacity})
        </button>

        <button
          onClick={() => setSelectedReason('panel_capacity')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
            selectedReason === 'panel_capacity'
              ? 'bg-purple-500/20 text-purple-200 border-purple-500/60 shadow'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-purple-300'
          }`}
        >
          Panel Bottleneck ({reasonStats.panel_capacity})
        </button>

        <button
          onClick={() => setSelectedReason('student_conflict')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
            selectedReason === 'student_conflict'
              ? 'bg-rose-500/20 text-rose-200 border-rose-500/60 shadow'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-rose-300'
          }`}
        >
          Student Conflicts ({reasonStats.student_conflict})
        </button>

        <button
          onClick={() => setSelectedReason('unknown')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
            selectedReason === 'unknown'
              ? 'bg-slate-700/60 text-slate-200 border-slate-500 shadow'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          Multi-Constraint ({reasonStats.unknown})
        </button>
      </div>

      {/* List Container */}
      <div className="overflow-y-auto max-h-96 space-y-2 pr-1">
        {filteredList.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No unscheduled interviews match your filter.
          </div>
        ) : (
          filteredList.map((item) => {
            const badge = getReasonBadge(item.reason);
            const isExpanded = expandedId === item.interview_id;

            return (
              <div
                key={item.interview_id}
                className="glass-card p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div
                  className="flex items-center justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : item.interview_id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-300 shrink-0">
                      {item.interview_id}
                    </span>
                    <span className="text-xs font-semibold text-white truncate">
                      {item.company_name || item.company_id}
                    </span>
                    <span className="text-xs font-mono text-indigo-300 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 shrink-0">
                      Student {item.student_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.classes}`}>
                      {badge.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Detail expansion */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 bg-slate-950/40 p-3 rounded-lg">
                    <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Binding Constraint Diagnosis:</span>
                    </div>
                    <p className="leading-relaxed text-slate-300">{item.detail}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Priority: Tier {item.priority || 2}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInterview(item);
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        Inspect details &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
