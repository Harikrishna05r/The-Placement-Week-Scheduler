import React from 'react';
import { X, Building2, User, Clock, DoorClosed, Layers, Shield, AlertCircle } from 'lucide-react';

export default function InterviewDetailModal({ interview, onClose }) {
  if (!interview) return null;

  return (
    <div className="modal-overlay">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono font-bold text-sm">
            {interview.interview_id ? interview.interview_id.split('-')[1] : 'INV'}
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-white">
              Interview Record
            </h3>
            <span className="font-mono text-xs text-indigo-400">
              {interview.interview_id}
            </span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          {/* Company */}
          <div className="glass-card p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Company:</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-white">{interview.company_name || interview.company_id}</div>
              <div className="text-[10px] text-slate-400 font-mono">{interview.company_id}</div>
            </div>
          </div>

          {/* Student */}
          <div className="glass-card p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Candidate:</span>
            </div>
            <div className="font-bold text-white font-mono">{interview.student_id}</div>
          </div>

          {/* Placement Location & Slot if scheduled */}
          {interview.room_id && (
            <div className="glass-card p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <DoorClosed className="w-4 h-4 text-emerald-400" />
                  <span>Assigned Room:</span>
                </div>
                <div className="font-bold text-emerald-300 font-mono">{interview.room_id}</div>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Assigned Panel:</span>
                </div>
                <div className="font-bold text-indigo-300 font-mono">Panel {interview.panel_no}</div>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Time Slot:</span>
                </div>
                <div className="font-bold text-amber-300 font-mono">{interview.slot_id}</div>
              </div>
            </div>
          )}

          {/* Infeasibility Reason if unscheduled */}
          {interview.reason && (
            <div className="glass-card p-3 rounded-xl border border-rose-500/30 bg-rose-950/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Infeasibility Reason:</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold text-[10px]">
                  {interview.reason}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                {interview.detail}
              </p>
            </div>
          )}

          {/* Priority */}
          <div className="glass-card p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Priority Level:</span>
            </div>
            <div className="font-bold text-purple-300">
              Tier {interview.priority || 2} {interview.priority === 1 ? '(High / Mass)' : interview.priority === 2 ? '(Mid)' : '(Niche)'}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="btn-secondary text-xs px-4"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
