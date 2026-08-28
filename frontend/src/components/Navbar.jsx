import React from 'react';
import { Calendar, Play, RefreshCw, AlertTriangle, CheckCircle2, Sparkles, Layers } from 'lucide-react';

export default function Navbar({
  onGenerate,
  onSchedule,
  onOpenDisruption,
  loading,
  status,
  hasData,
  hasSchedule,
  hasPendingDiff,
  onOpenPendingDiff,
}) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-indigo-400/30">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold font-display tracking-tight text-white">
              Placement Week Scheduler
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
              OR-Tools CP-SAT
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Automated Placement Scheduling & Infeasibility Diagnosis Engine
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
          <span className={`w-2 h-2 rounded-full ${
            loading ? 'bg-amber-400 animate-ping' :
            hasSchedule ? 'bg-emerald-400' :
            hasData ? 'bg-blue-400' : 'bg-slate-500'
          }`} />
          <span className="text-slate-300 font-medium">{status}</span>
        </div>

        {/* Generate Button */}
        <button
          id="btn-generate"
          onClick={onGenerate}
          disabled={loading}
          className="btn-secondary text-xs sm:text-sm font-medium py-2 px-3.5 rounded-lg flex items-center gap-2"
          title="Generate 35 Companies, 800 Students, 20 Rooms"
        >
          <RefreshCw className={`w-4 h-4 ${loading === 'generate' ? 'animate-spin' : ''}`} />
          <span>Generate Dataset</span>
        </button>

        {/* Schedule Button */}
        <button
          id="btn-schedule"
          onClick={onSchedule}
          disabled={loading || !hasData}
          className="btn-primary text-xs sm:text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
          title="Solve CP-SAT Cumulative & No-Overlap constraints"
        >
          <Play className={`w-4 h-4 fill-white ${loading === 'schedule' ? 'animate-bounce' : ''}`} />
          <span>Run Schedule</span>
        </button>

        {/* Trigger Disruption Button */}
        <button
          id="btn-trigger-disruption"
          onClick={onOpenDisruption}
          disabled={loading || !hasSchedule}
          className="btn-secondary text-xs sm:text-sm font-medium py-2 px-3.5 rounded-lg flex items-center gap-2 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
          title="Simulate company late, panel drop, student withdraw, or room unavailability"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Trigger Disruption</span>
        </button>

        {/* Pending Diff Review Button */}
        {hasPendingDiff && (
          <button
            id="btn-view-diff"
            onClick={onOpenPendingDiff}
            className="btn-primary text-xs sm:text-sm font-semibold py-2 px-3.5 rounded-lg flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 border-amber-400/40 shadow-lg shadow-amber-500/25 animate-pulse"
          >
            <Layers className="w-4 h-4 text-white" />
            <span>Review Diff Pending</span>
          </button>
        )}
      </div>
    </header>
  );
}
