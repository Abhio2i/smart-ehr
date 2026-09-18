import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { revokeShare, respondToShare, selectShareLoading } from '../../store/slices/shareSlice';
import { FileText, Clock, User, ShieldAlert, CheckCircle2, Ban, Send, X, AlertCircle, ExternalLink } from 'lucide-react';

export const ShareDetailsModal = ({ isOpen, onClose, share, currentUserId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectShareLoading);

  const [responseNotes, setResponseNotes] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  if (!isOpen || !share) return null;

  const isSharer = currentUserId && share.sharedByUserId === currentUserId;
  const isSpecialist = currentUserId && share.specialistUserId === currentUserId;
  const canRespond = (isSpecialist || share.shareType === 'EXTERNAL') && share.status !== 'REVOKED' && share.status !== 'EXPIRED';
  const canRevoke = isSharer && share.status !== 'REVOKED';

  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to revoke access to this ePCR record share?')) return;
    try {
      await dispatch(revokeShare(share.id)).unwrap();
    } catch (e) {
      alert(e || 'Failed to revoke share');
    }
  };

  const handleSendResponse = async (e) => {
    e.preventDefault();
    if (!responseNotes.trim()) return;

    setSubmittingResponse(true);
    try {
      await dispatch(respondToShare({ shareId: share.id, responseNotes: responseNotes.trim() })).unwrap();
      setResponseNotes('');
    } catch (e) {
      alert(e || 'Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} className="text-amber-600 animate-pulse" />
            Pending Review
          </span>
        );
      case 'VIEWED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-brand-blue border border-blue-200">
            <CheckCircle2 size={12} className="text-brand-blue" />
            Opened / Viewed
          </span>
        );
      case 'RESPONDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Responded
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <Ban size={12} className="text-rose-500" />
            Revoked
          </span>
        );
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-[#0F1A3A] border border-[#E2E8F0] rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-black text-[#0F1A3A] tracking-tight">Share Consultation Details</h2>
              {getStatusBadge(share.status)}
            </div>
            <p className="text-xs text-[#8A97B0]">
              Share ID: <span className="font-mono text-[#0F1A3A] font-bold">{share.id}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[#8A97B0] hover:text-[#0F1A3A] p-1.5 rounded-xl hover:bg-[#F8FAFC] transition">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
            <div>
              <span className="text-[#8A97B0] block text-[11px] font-semibold">Record ID</span>
              <span className="font-bold text-brand-blue font-mono">{share.recordId}</span>
            </div>
            <div>
              <span className="text-[#8A97B0] block text-[11px] font-semibold">Shared By</span>
              <span className="font-bold text-[#0F1A3A]">{share.sharedByName || 'Provider'}</span>
            </div>
            <div>
              <span className="text-[#8A97B0] block text-[11px] font-semibold">Recipient Specialist</span>
              <span className="font-bold text-[#0F1A3A]">{share.specialistName || share.specialistEmail || 'Specialist'}</span>
            </div>
            <div>
              <span className="text-[#8A97B0] block text-[11px] font-semibold">Share Type</span>
              <span className="font-bold text-[#0F1A3A]">{share.shareType}</span>
            </div>
            <div>
              <span className="text-[#8A97B0] block text-[11px] font-semibold">Specialty Requested</span>
              <span className="font-bold text-amber-700">{share.specialtyRequested || 'General'}</span>
            </div>
            <div>
              <span className="text-[#8A97B0] block text-[11px] font-semibold">Created At</span>
              <span className="font-bold text-[#4B5A7A]">{new Date(share.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Scope Access */}
          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
            <span className="text-[#8A97B0] font-bold block text-[11px]">Shared Data Scope</span>
            <div className="flex items-center gap-4 text-[#0F1A3A] font-semibold">
              <span>Full ePCR: <strong className={share.includeFullEpcr ? 'text-emerald-600' : 'text-slate-400'}>{share.includeFullEpcr ? 'Yes' : 'No'}</strong></span>
              <span>•</span>
              <span>Vitals History: <strong className={share.includeVitalsHistory ? 'text-emerald-600' : 'text-slate-400'}>{share.includeVitalsHistory ? 'Yes' : 'No'}</strong></span>
            </div>
          </div>

          {/* Clinical Question */}
          {share.clinicalQuestion && (
            <div className="p-4 bg-[#EEF2FF] border border-[#C8D5F0] rounded-xl space-y-1">
              <span className="text-brand-blue font-bold block text-[11px]">Clinical Question / Referral Context (PHI Encrypted)</span>
              <p className="text-[#0F1A3A] font-medium leading-relaxed italic">{share.clinicalQuestion}</p>
            </div>
          )}

          {/* Response Notes */}
          {share.responseNotes ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-emerald-800 font-bold block text-[11px]">Specialist Opinion / Response</span>
              <p className="text-emerald-950 font-medium leading-relaxed">{share.responseNotes}</p>
            </div>
          ) : (
            canRespond && (
              <form onSubmit={handleSendResponse} className="space-y-2 pt-3 border-t border-[#F0F4FC]">
                <label className="text-xs font-bold text-[#0F1A3A] block">Add Specialist Response / Clinical Opinion</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Enter specialist consult notes, recommendations, or clinical assessment..."
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingResponse}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 ml-auto shadow-sm active:scale-95 text-xs"
                >
                  <Send size={14} />
                  <span>Submit Opinion</span>
                </button>
              </form>
            )
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#F0F4FC] pt-4 mt-4 gap-3">
          {canRevoke ? (
            <button
              onClick={handleRevoke}
              disabled={loading}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <Ban size={14} />
              <span>Revoke Access</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                const targetId = share.patientId || share.recordId;
                navigate(targetId ? `/patient-history/${targetId}` : '/epcr');
              }}
              className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <ExternalLink size={14} />
              <span>View Patient History & Record</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#4B5A7A] text-xs font-bold rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ShareDetailsModal;
