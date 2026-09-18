import { useState } from 'react';
import { X, CreditCard, ShieldCheck, Loader2, Zap } from 'lucide-react';
import { createRazorpayOrder, verifyRazorpayPayment } from '../../api/billingApi';
import { useDispatch } from 'react-redux';
import { addToast } from '../../store/slices/uiSlice';

/**
 * PatientPaymentModal — Razorpay-powered payment checkout.
 *
 * Flow:
 *  1. "Pay via Razorpay" clicked → POST /razorpay-order → get { orderId, amount, keyId }
 *  2. Razorpay Checkout.js SDK opens natively (UPI / Card / Net Banking / Wallets)
 *  3. On success → POST /razorpay-verify with signature → backend settles claim to PAID
 *  4. onSuccess() callback refreshes parent UI
 */

// Load Razorpay Checkout.js script dynamically
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PatientPaymentModal({ claim, isOpen, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const totalAmount = claim.patientResponsibility ?? claim.totalAmount ?? claim.totalCharged ?? 0;
  const claimId = claim.id || claim.claimNumber;

  const handleRazorpayCheckout = async () => {
    setLoading(true);
    try {
      // Step 1: Load Razorpay SDK
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        dispatch(addToast({ type: 'error', message: 'Razorpay SDK failed to load. Check internet connection.' }));
        setLoading(false);
        return;
      }

      // Step 2: Create order via backend (server-side amount — never trust frontend)
      const order = await createRazorpayOrder(claimId);

      // Step 3: Configure Razorpay Checkout
      const options = {
        key: order.keyId,
        amount: order.amount,           // in paise
        currency: order.currency || 'INR',
        name: 'Smart-eHR Billing Portal',
        description: `Medical Bill Payment — Claim #${claim.claimNumber || claimId}`,
        order_id: order.orderId,
        prefill: {
          name: order.patientName || claim.patientName || 'Patient',
          contact: claim.patientPhone || '',
          email: claim.patientEmail || '',
        },
        notes: {
          claim_id: claimId,
          claim_number: claim.claimNumber || claimId,
        },
        theme: {
          color: '#1A3C8F',
        },
        // Step 4: On successful payment — verify with backend
        handler: async function (response) {
          try {
            await verifyRazorpayPayment(claimId, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            dispatch(addToast({
              type: 'success',
              message: `✅ Payment successful! Ref: ${response.razorpay_payment_id}`,
            }));

            if (onSuccess) onSuccess();
            onClose();
          } catch (verifyErr) {
            const msg = verifyErr.response?.data?.error || 'Payment verification failed. Contact support.';
            dispatch(addToast({ type: 'error', message: msg }));
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      // Step 5: Handle payment failure
      rzp.on('payment.failed', function (response) {
        dispatch(addToast({
          type: 'error',
          message: `Payment failed: ${response.error?.description || 'Please try again.'}`,
        }));
        setLoading(false);
      });

      rzp.open();

    } catch (err) {
      console.error('Razorpay checkout error:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to initiate payment. Please try again.';
      dispatch(addToast({ type: 'error', message: msg }));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A3C8F] to-[#0F1A3A] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sky-300">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Pay Medical Invoice</h3>
              <p className="text-[11px] text-blue-200 font-bold">Secured by Razorpay • PCI-DSS Compliant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Claim Summary Card */}
          <div className="bg-gradient-to-br from-blue-50/80 to-slate-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-mono font-bold text-[#1A3C8F] bg-blue-100/60 px-2 py-0.5 rounded">
                #{claim.claimNumber || claimId}
              </span>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {claim.patientName || claim.patientId || 'Patient'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount Due</span>
              <p className="text-2xl font-black text-[#0F1A3A]">₹{Number(totalAmount).toFixed(2)}</p>
            </div>
          </div>

          {/* Razorpay Info */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Accepted Payment Methods</p>
            <div className="flex flex-wrap gap-2">
              {['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallets', 'EMI'].map(method => (
                <span key={method} className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg">
                  {method}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              🔒 End-to-end encrypted. Card data handled securely by Razorpay. CVV is never stored.
            </p>
          </div>

          {/* Pay Button */}
          <button
            type="button"
            onClick={handleRazorpayCheckout}
            disabled={loading}
            className="w-full bg-[#1A3C8F] hover:bg-[#153278] text-white py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Opening Razorpay...</span>
              </>
            ) : (
              <>
                <Zap size={18} />
                <span>Pay ₹{Number(totalAmount).toFixed(2)} via Razorpay</span>
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-slate-400">
            By proceeding you agree to Razorpay's Terms of Service
          </p>
        </div>

      </div>
    </div>
  );
}
