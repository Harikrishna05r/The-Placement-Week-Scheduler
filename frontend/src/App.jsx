import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  Menu,
  LogOut,
  Search,
  Upload,
  Plus,
  Play,
  RefreshCw,
  AlertTriangle,
  FileText,
  Layers,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  DoorClosed,
  CheckCircle2,
  XCircle,
  Eye,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import GanttChart from './components/GanttChart';
import UnscheduledPanel from './components/UnscheduledPanel';
import DisruptionModal from './components/DisruptionModal';
import DiffReviewModal from './components/DiffReviewModal';
import InterviewDetailModal from './components/InterviewDetailModal';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export default function App() {
  const [activeNav, setActiveNav] = useState('gantt'); // 'gantt' | 'unscheduled' | 'replan' | 'metrics'
  const [scheduleData, setScheduleData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(null); // 'generate' | 'schedule' | 'replan' | null
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Pending Diff
  const [isDisruptionOpen, setIsDisruptionOpen] = useState(false);
  const [pendingDiff, setPendingDiff] = useState(null);
  const [pendingPostState, setPendingPostState] = useState(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);

  // Initial State Check
  useEffect(() => {
    fetchState();
  }, []);

  const fetchState = async () => {
    try {
      const res = await fetch(`${API_BASE}/state`);
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setSummaryData(data.summary);
          setHasData(true);
        }
        if (data.scheduled) {
          setScheduleData(data);
          setHasData(true);
        }
      }
    } catch (err) {
      console.warn('Backend not currently reachable at', API_BASE);
    }
  };

  const handleGenerate = async () => {
    setLoading('generate');
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_companies: 35,
          num_students: 800,
          num_rooms: 20,
          seed: 42,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate dataset');
      const data = await res.json();
      setHasData(true);
      setScheduleData(null);
      setPendingDiff(null);
      setPendingPostState(null);

      setSummaryData({
        companies: data.companies,
        students: data.students,
        rooms: data.rooms,
        total_interviews: data.interviews,
        days: 4,
      });
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleSchedule = async () => {
    setLoading('schedule');
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/schedule`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Solver failed to solve schedule');
      const data = await res.json();
      setScheduleData(data);
      if (data.summary) setSummaryData(data.summary);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleReplanSubmit = async (disruptionParams) => {
    setLoading('replan');
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(disruptionParams),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Replan simulation failed');
      }
      const data = await res.json();

      setIsDisruptionOpen(false);
      setPendingDiff(data.diff);
      setPendingPostState(data.post_replan_state);
      setIsDiffModalOpen(true);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleApplyDiff = () => {
    if (pendingPostState) {
      setScheduleData(pendingPostState);
      if (pendingPostState.summary) setSummaryData(pendingPostState.summary);
      setPendingDiff(null);
      setPendingPostState(null);
      setIsDiffModalOpen(false);
    }
  };

  const handleDiscardDiff = () => {
    setPendingDiff(null);
    setPendingPostState(null);
    setIsDiffModalOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans text-slate-900">
      {/* 1. LEFT SIDEBAR (Dark Navy) */}
      <aside className="w-64 bg-[#0d1b2a] text-slate-300 flex flex-col justify-between shrink-0 shadow-xl border-r border-[#1e293b]">
        <div>
          {/* Brand Logo & Geometric Cube */}
          <div className="p-6 pb-4 flex items-center gap-3 border-b border-[#1e293b]/60">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 via-emerald-400 to-indigo-500 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-[#0d1b2a] rounded-[10px] flex items-center justify-center">
                <div className="w-5 h-5 bg-gradient-to-tr from-lime-400 to-emerald-400 transform rotate-45 rounded-sm" />
              </div>
            </div>
            <div>
              <div className="font-bold text-white tracking-wider text-sm">PLACEMENT</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Scheduler v2.0</div>
            </div>
          </div>

          {/* Nav Section: WORKSPACE */}
          <div className="px-4 py-6">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
              WORKSPACE
            </div>

            <div className="space-y-1">
              {/* Category: Placement Week */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200 px-2 py-1.5 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-lime-400" />
                  <span>Scheduler Matrix</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* Sub-menu items */}
              <div className="pl-4 space-y-1 pt-1">
                <button
                  onClick={() => setActiveNav('gantt')}
                  className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors flex items-center justify-between ${
                    activeNav === 'gantt'
                      ? 'sidebar-pill-active'
                      : 'text-slate-400 hover:text-white hover:bg-[#1b263b]'
                  }`}
                >
                  <span>Gantt Timeline</span>
                  {scheduleData?.assignments && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/10">
                      {scheduleData.assignments.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveNav('unscheduled')}
                  className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors flex items-center justify-between ${
                    activeNav === 'unscheduled'
                      ? 'sidebar-pill-active'
                      : 'text-slate-400 hover:text-white hover:bg-[#1b263b]'
                  }`}
                >
                  <span>Infeasibility Backlog</span>
                  {scheduleData?.unscheduled && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                      {scheduleData.unscheduled.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveNav('replan');
                    setIsDisruptionOpen(true);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors flex items-center justify-between ${
                    activeNav === 'replan'
                      ? 'sidebar-pill-active'
                      : 'text-slate-400 hover:text-white hover:bg-[#1b263b]'
                  }`}
                >
                  <span>Disruption Replan</span>
                  {pendingDiff && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sidebar: Reset Session */}
        <div className="p-4 border-t border-[#1e293b]/60">
          <button
            onClick={() => {
              setScheduleData(null);
              setSummaryData(null);
              setHasData(false);
              setPendingDiff(null);
            }}
            className="w-full flex items-center gap-2 text-xs text-rose-400 hover:text-rose-300 px-3 py-2 rounded-lg hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Reset Workspace</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
              <Menu className="w-5 h-5 text-emerald-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-indigo-900 transform rotate-45 rounded-xs flex items-center justify-center">
                <div className="w-2 h-2 bg-lime-400" />
              </div>
              <span className="font-bold font-display text-slate-800 tracking-tight text-base">
                PWS · Placement Week Scheduler
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {pendingDiff && (
              <button
                onClick={() => setIsDiffModalOpen(true)}
                className="px-3 py-1 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-100 transition-colors animate-pulse"
              >
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>Pending Diff Review</span>
              </button>
            )}

            {/* Avatar Circle */}
            <div className="w-9 h-9 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center shadow-sm">
              C
            </div>
          </div>
        </header>

        {/* Action Bar & Search Strip */}
        <div className="p-6 pb-0">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            {/* Search Box */}
            <div className="flex items-center gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search company, student ID, or room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="btn-generate"
                onClick={handleGenerate}
                disabled={!!loading}
                className="btn-secondary-outline text-xs"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Generate Dataset</span>
              </button>

              <button
                id="btn-schedule"
                onClick={handleSchedule}
                disabled={!!loading || !hasData}
                className="btn-primary-dark text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{hasScheduleActive(scheduleData) ? 'Re-run Schedule' : 'Run Schedule'}</span>
              </button>

              <button
                id="btn-trigger-disruption"
                onClick={() => setIsDisruptionOpen(true)}
                disabled={!!loading || !hasScheduleActive(scheduleData)}
                className="btn-secondary-outline text-xs border-amber-300 text-amber-900 hover:bg-amber-50"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Trigger Disruption</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. MAIN CARD WORKSPACE CONTAINER */}
        <main className="p-6 flex-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[600px] flex flex-col justify-between">
            {/* Top Profile / Coordinator Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500 text-white text-2xl font-bold font-display flex items-center justify-center shadow-md">
                  C
                </div>
                <div>
                  <h2 className="text-xl font-bold font-display text-slate-900 tracking-tight">
                    Placement Coordinator Console
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    Workspace Session: 2026-PWS-BATCH-01 · 35 Companies · 800 Students · 20 Rooms
                  </p>
                </div>
              </div>

              {/* Status Pill Metrics */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Placement Status
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {scheduleData?.metrics
                      ? `${scheduleData.metrics.scheduled} Scheduled (${scheduleData.metrics.pct_scheduled}%)`
                      : hasData
                      ? 'Dataset Loaded (Ready to Solve)'
                      : 'Awaiting Dataset'}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Body Based on Navigation */}
            <div className="mt-6 flex-1">
              {scheduleData?.scheduled ? (
                <>
                  {activeNav === 'gantt' && (
                    <GanttChart
                      rooms={scheduleData.rooms || []}
                      slots={scheduleData.slots || []}
                      assignments={scheduleData.assignments || []}
                      onSelectInterview={setSelectedInterview}
                    />
                  )}

                  {activeNav === 'unscheduled' && (
                    <UnscheduledPanel
                      unscheduled={scheduleData.unscheduled || []}
                      onSelectInterview={setSelectedInterview}
                    />
                  )}

                  {activeNav === 'replan' && (
                    <div className="space-y-6">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-amber-900">Operational Replan Engine</h4>
                          <p className="text-xs text-amber-700">Simulate company late arrival, panel drop, student withdrawal, or room maintenance outage.</p>
                        </div>
                        <button
                          onClick={() => setIsDisruptionOpen(true)}
                          className="btn-primary-dark text-xs"
                        >
                          Trigger Disruption Form
                        </button>
                      </div>

                      <GanttChart
                        rooms={scheduleData.rooms || []}
                        slots={scheduleData.slots || []}
                        assignments={scheduleData.assignments || []}
                        onSelectInterview={setSelectedInterview}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mx-auto mb-4">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold font-display text-slate-900 mb-1">
                    {hasData ? 'Dataset Generated — Ready to Solve' : 'No Active Placement Schedule'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                    {hasData
                      ? 'Dataset loaded with 35 companies, 800 candidates, and 20 parallel interview rooms. Click "Run Schedule" to solve CP-SAT interval scheduling.'
                      : 'Click "Generate Dataset" above to synthesize shortlists, panels, and rooms for placement week.'}
                  </p>
                  <div>
                    {!hasData ? (
                      <button
                        onClick={handleGenerate}
                        disabled={!!loading}
                        className="btn-primary-dark text-xs py-2 px-5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading === 'generate' ? 'animate-spin' : ''}`} />
                        <span>Generate Dataset</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleSchedule}
                        disabled={!!loading}
                        className="btn-primary-dark text-xs py-2 px-5"
                      >
                        <Play className={`w-3.5 h-3.5 fill-white ${loading === 'schedule' ? 'animate-bounce' : ''}`} />
                        <span>Run Schedule</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <DisruptionModal
        isOpen={isDisruptionOpen}
        onClose={() => setIsDisruptionOpen(false)}
        onSubmit={handleReplanSubmit}
        loading={loading === 'replan'}
        companies={scheduleData?.companies || []}
        rooms={scheduleData?.rooms || []}
      />

      <DiffReviewModal
        isOpen={isDiffModalOpen}
        diff={pendingDiff}
        onApply={handleApplyDiff}
        onDiscard={handleDiscardDiff}
      />

      <InterviewDetailModal
        interview={selectedInterview}
        onClose={() => setSelectedInterview(null)}
      />
    </div>
  );
}

function hasScheduleActive(data) {
  return data && data.scheduled && data.assignments && data.assignments.length > 0;
}
