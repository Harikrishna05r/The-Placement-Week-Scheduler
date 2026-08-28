import React, { useState } from 'react';
import { X, AlertTriangle, Clock, Users, DoorClosed, Sparkles, Send, ShieldAlert } from 'lucide-react';

export default function DisruptionModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
  companies = [],
  rooms = [],
  assignments = [],
}) {
  if (!isOpen) return null;

  const [disruptionType, setDisruptionType] = useState('company_late');
  const [targetId, setTargetId] = useState(companies[0]?.id || 'C003');
  const [hoursLate, setHoursLate] = useState(2);
  const [panelNo, setPanelNo] = useState(1);

  const selectedCompany = companies.find((c) => c.id === targetId);

  // Available target options
  const sampleStudents = ['S0283', 'S0035', 'S0161', 'S0541', 'S0244'];

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      type: disruptionType,
      target_id: targetId,
      hours_late: disruptionType === 'company_late' ? Number(hoursLate) : undefined,
      panel_no: disruptionType === 'panel_drop' ? Number(panelNo) : undefined,
    };
    onSubmit(payload);
  };

  const handleApplyPreset = (type, id, hrs = 2, pNo = 1) => {
    setDisruptionType(type);
    setTargetId(id);
    if (hrs) setHoursLate(hrs);
    if (pNo) setPanelNo(pNo);
  };

  return (
    <div className="modal-overlay">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display text-white">
              Trigger Operational Disruption
            </h3>
            <p className="text-xs text-slate-400">
              Simulate live placement week events and re-solve with minimal schedule churn.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Recommended Quick Presets:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleApplyPreset('company_late', 'C003', 2)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-left text-slate-300 hover:text-amber-200 transition-colors"
            >
              <div className="font-semibold text-amber-400">C003 Late by 2h</div>
              <div className="text-[10px] text-slate-400">GreenGrid Energy Tech</div>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('panel_drop', 'C007', null, 6)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-purple-500/50 text-left text-slate-300 hover:text-purple-200 transition-colors"
            >
              <div className="font-semibold text-purple-400">C007 Panel Drop</div>
              <div className="text-[10px] text-slate-400">Lucent Devices (Drop P6)</div>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('student_withdraw', 'S0283')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-rose-500/50 text-left text-slate-300 hover:text-rose-200 transition-colors"
            >
              <div className="font-semibold text-rose-400">S0283 Withdraw</div>
              <div className="text-[10px] text-slate-400">Drops active shortlists</div>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('room_unavailable', 'R01')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-blue-500/50 text-left text-slate-300 hover:text-blue-200 transition-colors"
            >
              <div className="font-semibold text-blue-400">Room R01 Down</div>
              <div className="text-[10px] text-slate-400">Remove from room pool</div>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Disruption Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Disruption Category
            </label>
            <select
              id="select-disruption-type"
              value={disruptionType}
              onChange={(e) => {
                const newType = e.target.value;
                setDisruptionType(newType);
                if (newType === 'company_late' || newType === 'panel_drop') {
                  setTargetId(companies[0]?.id || 'C001');
                } else if (newType === 'student_withdraw') {
                  setTargetId('S0283');
                } else if (newType === 'room_unavailable') {
                  setTargetId(rooms[0]?.id || 'R01');
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="company_late">1. Company Arrives Late (company_late)</option>
              <option value="panel_drop">2. Interviewer Panel Drops (panel_drop)</option>
              <option value="student_withdraw">3. Student Withdraws / Accepted Offer (student_withdraw)</option>
              <option value="room_unavailable">4. Room Unavailable / Maintenance (room_unavailable)</option>
            </select>
          </div>

          {/* Dynamic Inputs Based on Type */}
          {disruptionType === 'company_late' && (
            <div className="space-y-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Company
                </label>
                <select
                  id="select-company-late-target"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} - {c.name} (Day {c.day}, {c.num_panels} panels)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Delay Duration:</span>
                  <span className="font-bold text-amber-400 font-mono">{hoursLate} Hours Late</span>
                </div>
                <input
                  id="input-hours-late"
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={hoursLate}
                  onChange={(e) => setHoursLate(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                  <span>1 Hour (10:00 AM)</span>
                  <span>2 Hours (11:00 AM)</span>
                  <span>3 Hours (12:00 PM)</span>
                  <span>4 Hours (1:00 PM)</span>
                </div>
              </div>
            </div>
          )}

          {disruptionType === 'panel_drop' && (
            <div className="space-y-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Company
                </label>
                <select
                  id="select-panel-drop-company"
                  value={targetId}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    const comp = companies.find((c) => c.id === e.target.value);
                    if (comp) setPanelNo(comp.num_panels);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} - {c.name} ({c.num_panels} active panels)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Panel Number to Drop
                </label>
                <input
                  id="input-panel-no"
                  type="number"
                  min="1"
                  max={selectedCompany?.num_panels || 10}
                  value={panelNo}
                  onChange={(e) => setPanelNo(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Company {targetId} currently has {selectedCompany?.num_panels || 6} panels. Dropping panel {panelNo} will reduce panel capacity by 1.
                </p>
              </div>
            </div>
          )}

          {disruptionType === 'student_withdraw' && (
            <div className="space-y-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Student ID
                </label>
                <input
                  id="input-student-id"
                  type="text"
                  placeholder="e.g. S0283"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-400">Quick select sample student:</span>
                  {sampleStudents.map((sId) => (
                    <button
                      key={sId}
                      type="button"
                      onClick={() => setTargetId(sId)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-indigo-300"
                    >
                      {sId}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {disruptionType === 'room_unavailable' && (
            <div className="space-y-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Unavailable Room
                </label>
                <select
                  id="select-room-id"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.id})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Room will be decommissioned and excluded from solver room capacity tracks.
                </p>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-replan"
              disabled={loading || !targetId}
              className="btn-primary text-xs flex items-center gap-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Re-solving in background...' : 'Replan & Review Diff'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
