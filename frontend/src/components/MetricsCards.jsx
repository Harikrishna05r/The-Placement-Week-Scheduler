import React from 'react';
import { CheckCircle, XCircle, BarChart3, DoorClosed, Users, Building2, TrendingUp, Zap } from 'lucide-react';

export default function MetricsCards({ metrics, hasSchedule, companyCount, roomCount, studentCount }) {
  const pctScheduled = metrics?.pct_scheduled ?? 0;
  const roomUtil = metrics?.room_utilization_pct ?? 0;
  const scheduledCount = metrics?.scheduled ?? 0;
  const unscheduledCount = metrics?.unscheduled ?? 0;
  const totalInterviews = metrics?.total_interviews ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Placement Rate */}
      <div className="glass-card p-4.5 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Placement Rate</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold font-display text-white">{pctScheduled}%</span>
          <span className="text-xs text-slate-400 font-medium">({scheduledCount} / {totalInterviews})</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pctScheduled}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Target: &gt; 90%</span>
          <span className="text-emerald-400 font-medium">{hasSchedule ? 'Optimal solved' : 'Awaiting solver'}</span>
        </div>
      </div>

      {/* Card 2: Room Utilization */}
      <div className="glass-card p-4.5 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Room Utilization</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <DoorClosed className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold font-display text-white">{roomUtil}%</span>
          <span className="text-xs text-slate-400 font-medium">({roomCount} active rooms)</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, roomUtil)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Capacity: 5 Days (9am-5pm)</span>
          <span className="text-indigo-400 font-medium">Balanced load</span>
        </div>
      </div>

      {/* Card 3: Unscheduled Bottlenecks */}
      <div className="glass-card p-4.5 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Unscheduled Backlog</span>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <XCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold font-display text-white">{unscheduledCount}</span>
          <span className="text-xs text-slate-400 font-medium">interviews diagnosed</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${totalInterviews ? (unscheduledCount / totalInterviews) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Infeasibility reasons categorized</span>
          <span className="text-rose-400 font-medium">See triage list</span>
        </div>
      </div>

      {/* Card 4: Ecosystem Scale */}
      <div className="glass-card p-4.5 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Placement Scope</span>
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-3 mb-2">
          <div>
            <span className="text-xl font-bold font-display text-white">{companyCount}</span>
            <span className="text-[11px] text-slate-400 block -mt-1">Companies</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div>
            <span className="text-xl font-bold font-display text-white">{studentCount}</span>
            <span className="text-[11px] text-slate-400 block -mt-1">Students</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div>
            <span className="text-xl font-bold font-display text-white">{roomCount}</span>
            <span className="text-[11px] text-slate-400 block -mt-1">Rooms</span>
          </div>
        </div>
        <div className="mt-3 text-[11px] flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
            Tier 1: Mass
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
            Tier 2: Mid
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
            Tier 3: Niche
          </span>
        </div>
      </div>
    </div>
  );
}
