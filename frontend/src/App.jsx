import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MetricsCards from './components/MetricsCards';
import GanttChart from './components/GanttChart';
import UnscheduledPanel from './components/UnscheduledPanel';
import DisruptionModal from './components/DisruptionModal';
import DiffReviewModal from './components/DiffReviewModal';
import InterviewDetailModal from './components/InterviewDetailModal';
import { Sparkles, Calendar, AlertCircle, ArrowRight, Zap, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export default function App() {
  const [scheduleData, setScheduleData] = useState(null);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(null); // 'generate' | 'schedule' | 'replan' | null
  const [statusText, setStatusText] = useState('Ready to generate dataset');
  const [errorMessage, setErrorMessage] = useState(null);

  // Modals & Pending State
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
        if (data.scheduled) {
          setScheduleData(data);
          setHasData(true);
          setStatusText(`Active Schedule: ${data.metrics?.scheduled} Placed (${data.metrics?.pct_scheduled}%)`);
        } else if (data.companies > 0) {
          setHasData(true);
          setStatusText(`Dataset Ready: ${data.companies} Companies, ${data.rooms} Rooms`);
        }
      }
    } catch (err) {
      console.warn('Backend not currently reachable at', API_BASE);
    }
  };

  const handleGenerate = async () => {
    setLoading('generate');
    setErrorMessage(null);
    setStatusText('Generating placement week dataset (35 companies, 800 students)...');
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
      setStatusText(`Generated ${data.companies} Companies, ${data.students} Students, ${data.interviews} Shortlists across ${data.rooms} Rooms`);
    } catch (err) {
      setErrorMessage(err.message);
      setStatusText('Generation failed');
    } finally {
      setLoading(null);
    }
  };

  const handleSchedule = async () => {
    setLoading('schedule');
    setErrorMessage(null);
    setStatusText('Solving CP-SAT interval scheduling constraints...');
    try {
      const res = await fetch(`${API_BASE}/schedule`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Solver failed to run schedule');
      const data = await res.json();
      setScheduleData(data);
      setStatusText(`Schedule Solved! ${data.metrics?.scheduled} Scheduled (${data.metrics?.pct_scheduled}%), ${data.metrics?.unscheduled} Backlog`);
    } catch (err) {
      setErrorMessage(err.message);
      setStatusText('Scheduling failed');
    } finally {
      setLoading(null);
    }
  };

  const handleReplanSubmit = async (disruptionParams) => {
    setLoading('replan');
    setErrorMessage(null);
    setStatusText(`Simulating replan for disruption (${disruptionParams.type})...`);
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
      
      // Close disruption modal
      setIsDisruptionOpen(false);

      // Store pending diff and pending post-replan state without applying to Gantt yet!
      setPendingDiff(data.diff);
      setPendingPostState(data.post_replan_state);
      setIsDiffModalOpen(true);
      setStatusText(`Replan solved with ${data.diff.pct_unaffected}% stability. Awaiting coordinator review.`);
    } catch (err) {
      setErrorMessage(err.message);
      setStatusText('Replan simulation failed');
    } finally {
      setLoading(null);
    }
  };

  const handleApplyDiff = () => {
    if (pendingPostState) {
      setScheduleData(pendingPostState);
      setPendingDiff(null);
      setPendingPostState(null);
      setIsDiffModalOpen(false);
      setStatusText('Replan applied successfully! Timeline updated to new schedule.');
    }
  };

  const handleDiscardDiff = () => {
    setPendingDiff(null);
    setPendingPostState(null);
    setIsDiffModalOpen(false);
    setStatusText('Replan discarded. Maintained existing schedule.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        onGenerate={handleGenerate}
        onSchedule={handleSchedule}
        onOpenDisruption={() => setIsDisruptionOpen(true)}
        loading={loading}
        status={statusText}
        hasData={hasData}
        hasSchedule={!!scheduleData?.scheduled}
        hasPendingDiff={!!pendingDiff}
        onOpenPendingDiff={() => setIsDiffModalOpen(true)}
      />

      {/* Main Coordinator Dashboard Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Pending Replan Diff Banner */}
        {pendingDiff && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-950/50 via-slate-900 to-indigo-950/50 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold">
                !
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-300 font-display">
                  Replan Diff Pending Approval
                </h4>
                <p className="text-xs text-slate-300">
                  {pendingDiff.unaffected_count} of {pendingDiff.total_prior_scheduled} bookings unaffected ({pendingDiff.pct_unaffected}%). {pendingDiff.moved.length} moved, {pendingDiff.cancelled.length} cancelled.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleDiscardDiff}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Discard
              </button>
              <button
                onClick={() => setIsDiffModalOpen(true)}
                className="btn-primary text-xs py-1.5 px-4 bg-amber-500 hover:bg-amber-600 border-amber-400"
              >
                Inspect & Apply Diff &rarr;
              </button>
            </div>
          </div>
        )}

        {/* KPI Metrics Strip */}
        <MetricsCards
          metrics={scheduleData?.metrics}
          hasSchedule={!!scheduleData?.scheduled}
          companyCount={scheduleData?.companies?.length || (hasData ? 35 : 0)}
          roomCount={scheduleData?.rooms?.length || (hasData ? 20 : 0)}
          studentCount={hasData ? 800 : 0}
        />

        {/* Main Content: Gantt Chart or Getting Started Banner */}
        {scheduleData?.scheduled ? (
          <>
            <GanttChart
              rooms={scheduleData.rooms || []}
              slots={scheduleData.slots || []}
              assignments={scheduleData.assignments || []}
              onSelectInterview={setSelectedInterview}
            />

            {/* Unscheduled Infeasibility Diagnosis Triage Panel */}
            <UnscheduledPanel
              unscheduled={scheduleData.unscheduled || []}
              onSelectInterview={setSelectedInterview}
            />
          </>
        ) : (
          <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 my-8 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-4 shadow-lg shadow-indigo-500/10">
              <Calendar className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-display text-white mb-2">
              {hasData ? 'Dataset Ready — Run Solver to Schedule' : 'Welcome to Placement Week Scheduler'}
            </h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
              {hasData
                ? 'Dataset generated with 35 companies, 800 students, 20 interview rooms, and ~3,600 shortlist interviews. Click "Run Schedule" to solve CP-SAT cumulative and no-overlap constraints.'
                : 'Click "Generate Dataset" to synthesize placement week parameters (Tier 1 mass recruiters, Tier 2 mid-tier, and Tier 3 niche companies), or "Run Schedule" to solve.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {!hasData ? (
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="btn-primary text-sm py-2.5 px-6 rounded-xl flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading === 'generate' ? 'animate-spin' : ''}`} />
                  <span>Generate Placement Dataset</span>
                </button>
              ) : (
                <button
                  onClick={handleSchedule}
                  disabled={loading}
                  className="btn-primary text-sm py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-indigo-500/30"
                >
                  <Zap className={`w-4 h-4 ${loading === 'schedule' ? 'animate-bounce' : ''}`} />
                  <span>Run CP-SAT Solver</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Disruption Trigger Modal */}
      <DisruptionModal
        isOpen={isDisruptionOpen}
        onClose={() => setIsDisruptionOpen(false)}
        onSubmit={handleReplanSubmit}
        loading={loading === 'replan'}
        companies={scheduleData?.companies || []}
        rooms={scheduleData?.rooms || []}
        assignments={scheduleData?.assignments || []}
      />

      {/* Replan Diff Review Modal */}
      <DiffReviewModal
        isOpen={isDiffModalOpen}
        diff={pendingDiff}
        onApply={handleApplyDiff}
        onDiscard={handleDiscardDiff}
      />

      {/* Interview Detail Inspector Modal */}
      <InterviewDetailModal
        interview={selectedInterview}
        onClose={() => setSelectedInterview(null)}
      />
    </div>
  );
}
