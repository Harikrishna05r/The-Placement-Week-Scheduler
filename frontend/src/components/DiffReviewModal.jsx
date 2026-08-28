import React, { useState } from 'react';
import { Check, X, ArrowRight, AlertTriangle, CheckCircle2, XCircle, ArrowUpRight, Sparkles, Building2, User } from 'lucide-react';

export default function DiffReviewModal({
  isOpen,
  diff,
  onApply,
  onDiscard,
}) {
  if (!isOpen || !diff) return null;

  const [activeTab, setActiveTab] = useState('moved');

  const {
    moved = [],
    cancelled = [],
    newly_scheduled = [],
    unaffected_count = 0,
    total_prior_scheduled = 0,
    pct_unaffected = 100,
    affected_students = [],
    affected_companies = [],
  } = diff;

  return (
    <div className="modal-overlay">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-display text-white">
                  Replan Diff Inspection & Approval
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {pct_unaffected}% Stable
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Review schedule disturbance impact before committing changes to the active placement week timeline.
              </p>
            </div>
          </div>

          <button
            onClick={onDiscard}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff KPI Summary Cards */}
        <div className="p-5 pb-3 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Unaffected */}
          <div className="glass-card p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold mb-1">
              <span>Unaffected</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-display text-emerald-400">
              {unaffected_count}
            </div>
            <div className="text-[10px] text-emerald-500/80 font-medium">
              {pct_unaffected}% of prior schedule
            </div>
          </div>

          {/* Card 2: Moved */}
          <div className="glass-card p-3 rounded-xl border border-amber-500/30 bg-amber-950/20">
            <div className="flex items-center justify-between text-xs text-amber-300 font-semibold mb-1">
              <span>Moved</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-display text-amber-400">
              {moved.length}
            </div>
            <div className="text-[10px] text-amber-500/80 font-medium">
              Time/room shifted
            </div>
          </div>

          {/* Card 3: Cancelled */}
          <div className="glass-card p-3 rounded-xl border border-rose-500/30 bg-rose-950/20">
            <div className="flex items-center justify-between text-xs text-rose-300 font-semibold mb-1">
              <span>Cancelled</span>
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-display text-rose-400">
              {cancelled.length}
            </div>
            <div className="text-[10px] text-rose-500/80 font-medium">
              Dropped from schedule
            </div>
          </div>

          {/* Card 4: Newly Scheduled */}
          <div className="glass-card p-3 rounded-xl border border-blue-500/30 bg-blue-950/20">
            <div className="flex items-center justify-between text-xs text-blue-300 font-semibold mb-1">
              <span>Newly Added</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-display text-blue-400">
              {newly_scheduled.length}
            </div>
            <div className="text-[10px] text-blue-500/80 font-medium">
              Backlog placed in gaps
            </div>
          </div>
        </div>

        {/* Affected Entities Chips */}
        <div className="px-5 pb-3 text-xs flex flex-wrap items-center gap-3 text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span>Affected Students: <strong className="text-slate-200">{affected_students.length}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Affected Companies: <strong className="text-slate-200">{affected_companies.length}</strong></span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 flex items-center gap-2 border-b border-slate-800 shrink-0">
          <button
            id="tab-diff-moved"
            onClick={() => setActiveTab('moved')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'moved'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Moved Interviews ({moved.length})
          </button>
          <button
            id="tab-diff-cancelled"
            onClick={() => setActiveTab('cancelled')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'cancelled'
                ? 'border-rose-400 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cancelled Interviews ({cancelled.length})
          </button>
          <button
            id="tab-diff-newly"
            onClick={() => setActiveTab('newly_scheduled')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'newly_scheduled'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Newly Scheduled ({newly_scheduled.length})
          </button>
        </div>

        {/* Scrollable List Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs">
          {activeTab === 'moved' && (
            <div className="space-y-2">
              {moved.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No existing interviews were moved during this replan.
                </div>
              ) : (
                moved.map((m) => (
                  <div
                    key={m.interview_id}
                    className="glass-card p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-200">{m.interview_id}</span>
                        <span className="font-semibold text-white">{m.company_name || m.company_id}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                          {m.student_id}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      {/* Old */}
                      <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        {m.old.room} | P{m.old.panel} | {m.old.slot}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                      {/* New */}
                      <div className="px-2 py-1 rounded bg-amber-950/40 border border-amber-500/40 text-amber-300 font-semibold">
                        {m.new.room} | P{m.new.panel} | {m.new.slot}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'cancelled' && (
            <div className="space-y-2">
              {cancelled.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No interviews were cancelled during this replan.
                </div>
              ) : (
                cancelled.map((c) => (
                  <div
                    key={c.interview_id}
                    className="glass-card p-3 rounded-xl border border-rose-500/30 bg-rose-950/10"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-300">{c.interview_id}</span>
                        <span className="font-semibold text-white">{c.company_name || c.company_id}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200">
                          {c.student_id}
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                        {c.reason}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{c.detail}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'newly_scheduled' && (
            <div className="space-y-2">
              {newly_scheduled.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No new backlog interviews were placed during this replan.
                </div>
              ) : (
                newly_scheduled.map((n) => (
                  <div
                    key={n.interview_id}
                    className="glass-card p-3 rounded-xl border border-blue-500/30 bg-blue-950/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-300">{n.interview_id}</span>
                      <span className="font-semibold text-white">{n.company_name || n.company_id}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-200">
                        {n.student_id}
                      </span>
                    </div>
                    <div className="font-mono text-xs px-2 py-1 rounded bg-blue-950/60 border border-blue-500/40 text-blue-300 font-semibold">
                      {n.room} | Panel {n.panel} | {n.slot}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60 rounded-b-2xl">
          <button
            onClick={onDiscard}
            id="btn-discard-diff"
            className="btn-secondary text-xs"
          >
            Discard Diff (Keep Prior Schedule)
          </button>

          <button
            onClick={onApply}
            id="btn-apply-replan"
            className="btn-primary text-xs font-bold py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Apply Replan to Schedule</span>
          </button>
        </div>
      </div>
    </div>
  );
}
