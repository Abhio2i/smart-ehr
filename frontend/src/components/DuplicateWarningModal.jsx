import React, { useState } from 'react';
import { AlertTriangle, UserCheck, GitMerge, X, ShieldAlert } from 'lucide-react';
import client from '../api/client';

/**
 * DuplicateWarningModal — TPH TB-DQA 1.1 UI Component
 * Rendered when potential duplicate client records are detected upon patient creation.
 */
const DuplicateWarningModal = ({ isOpen, candidates = [], onCancel, onConfirmOverride, onMergeSuccess }) => {
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [selectedCandidateForMerge, setSelectedCandidateForMerge] = useState(null);
  const [mergeReason, setMergeReason] = useState('');
  const [showMergeInput, setShowMergeInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || candidates.length === 0) return null;

  const handleOverrideSubmit = async () => {
    if (!overrideReason.trim()) {
      alert('Please enter a mandatory justification reason for overriding the duplicate warning.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirmOverride(overrideReason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  const handleMergeSubmit = async () => {
    if (!selectedCandidateForMerge) return;
    if (!mergeReason.trim()) {
      alert('Please enter a mandatory justification reason for merging patient records.');
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/api/patients/merge', {
        primaryPatientId: selectedCandidateForMerge.patientId,
        secondaryPatientId: 'NEW_RECORD', // or handle merge target selection
        reason: mergeReason.trim()
      });
      if (onMergeSuccess) onMergeSuccess(selectedCandidateForMerge);
    } catch (err) {
      console.error('Merge failed:', err);
      alert(err.response?.data?.message || 'Failed to merge patient records.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3 text-amber-400">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Potential Duplicate Client Detected</h3>
              <p className="text-xs text-amber-400/80">TPH TB-DQA 1.1 Safeguard Algorithm</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Body */}
        <p className="text-sm text-slate-300 mb-4">
          The system found <span className="font-semibold text-amber-400">{candidates.length} candidate record(s)</span> matching the name phonetically or date of birth. Review existing records below before creating a new entry:
        </p>

        {/* Candidate List */}
        <div className="space-y-3 max-h-60 overflow-y-auto mb-6 pr-1">
          {candidates.map((cand, idx) => (
            <div key={idx} className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3.5 flex items-center justify-between gap-4 hover:border-slate-600 transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">{cand.patientName || 'Unnamed Record'}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                    {Math.round(cand.confidence)}% Match
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span>ID: <code className="text-slate-300">{cand.patientId}</code></span>
                  <span>DOB: <code className="text-slate-300">{cand.dateOfBirth || 'N/A'}</code></span>
                  <span>Phone: <code className="text-slate-300">{cand.phone || 'N/A'}</code></span>
                </div>
                <div className="flex gap-1.5 pt-1">
                  {cand.matchedSignals?.map((sig, sIdx) => (
                    <span key={sIdx} className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-300 rounded font-mono">
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { setSelectedCandidateForMerge(cand); setShowMergeInput(true); setShowOverrideInput(false); }}
                className="px-3 py-1.5 text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg flex items-center gap-1.5 transition font-medium whitespace-nowrap"
              >
                <GitMerge className="w-3.5 h-3.5" /> Select to Merge
              </button>
            </div>
          ))}
        </div>

        {/* Override Form */}
        {showOverrideInput && (
          <div className="bg-slate-800/50 border border-amber-500/20 rounded-lg p-3.5 mb-4 space-y-2 animate-in fade-in">
            <label className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Mandatory Justification for Override (Twin, Same Name, etc.)
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Verified client identity with OHIP card. Client is twin brother of existing patient."
              rows={2}
              className="w-full text-xs bg-slate-900 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowOverrideInput(false)} className="text-xs px-3 py-1 text-slate-400 hover:text-white">Cancel</button>
              <button
                onClick={handleOverrideSubmit}
                disabled={submitting}
                className="text-xs px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium disabled:opacity-50"
              >
                {submitting ? 'Logging Override...' : 'Confirm Permanent Override'}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!showOverrideInput && !showMergeInput && (
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition font-medium"
            >
              Cancel & Edit Info
            </button>
            <button
              onClick={() => setShowOverrideInput(true)}
              className="px-4 py-2 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg transition font-medium flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4" /> Override Duplicate Warning
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateWarningModal;
