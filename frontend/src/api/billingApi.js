import client from './client';

/**
 * Enterprise Billing API Client
 * Interacts with Spring Boot backend package `com.healthcare.epcr.billing.controller`
 */

/**
 * Fetch paginated claims list for current tenant organization
 * GET /api/billing/claims?page=0&size=20&status=DRAFT
 */
export const getClaims = async (params = {}) => {
  const response = await client.get('/api/billing/claims', { params });
  return response.data;
};

/**
 * Fetch single claim details by ID
 * GET /api/billing/claims/{id}
 */
export const getClaimById = async (id) => {
  const response = await client.get(`/api/billing/claims/${id}`);
  return response.data;
};

/**
 * Create a new billing claim (Draft state)
 * POST /api/billing/claims
 * Supports Idempotency-Key header to prevent duplicate creation
 */
export const createClaim = async (claimData, idempotencyKey = null) => {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const response = await client.post('/api/billing/claims', claimData, { headers });
  return response.data;
};

/**
 * Update an existing draft claim
 * PUT /api/billing/claims/{id}
 */
export const updateClaim = async (id, claimData) => {
  const response = await client.put(`/api/billing/claims/${id}`, claimData);
  return response.data;
};

/**
 * Submit claim to insurance payer (READY / DRAFT -> SUBMITTED)
 * POST /api/billing/claims/{id}/submit
 */
export const submitClaim = async (id) => {
  const response = await client.post(`/api/billing/claims/${id}/submit`);
  return response.data;
};

/**
 * Deny claim with reason (SUBMITTED -> DENIED)
 * POST /api/billing/claims/{id}/deny
 */
export const denyClaim = async (id, denialCode, denialReason) => {
  const response = await client.post(`/api/billing/claims/${id}/deny`, { denialCode, denialReason });
  return response.data;
};

/**
 * Appeal a denied claim (DENIED -> APPEALED)
 * POST /api/billing/claims/{id}/appeal
 */
export const appealClaim = async (id) => {
  const response = await client.post(`/api/billing/claims/${id}/appeal`);
  return response.data;
};

/**
 * Void/Delete a draft or rejected claim
 * DELETE /api/billing/claims/{id}
 */
export const voidClaim = async (id) => {
  const cleanId = encodeURIComponent(id);
  const response = await client.delete(`/api/billing/claims/${cleanId}`);
  return response.data;
};

/**
 * Fetch patient claims summary for Patient Portal
 * GET /api/patient-portal/billing/claims
 */
export const getPatientClaims = async () => {
  const response = await client.get('/api/patient-portal/billing/claims');
  return response.data;
};

/**
 * Validate coverage card eligibility
 * POST /api/billing/claims/{id}/validate
 */
export const validateCoverageCard = async (id) => {
  const response = await client.post(`/api/billing/claims/${id}/validate`);
  return response.data;
};

/**
 * Batch submit selected claims
 * POST /api/billing/claims/batch-submit
 */
export const submitClaimsBatch = async (claimIds) => {
  const response = await client.post('/api/billing/claims/batch-submit', { claimIds });
  return response.data;
};

/**
 * Search patients by query (name, phone, patientId, email)
 * GET /api/admin/patients/search?query=...
 */
export const searchPatients = async (query = '') => {
  const response = await client.get('/api/admin/patients/search', {
    params: { query, limit: 10 }
  });
  return response.data;
};

/**
 * Pay a patient claim/bill
 * POST /api/patient-portal/billing/claims/{id}/pay
 */
export const payPatientClaim = async (id, paymentData = {}) => {
  const response = await client.post(`/api/patient-portal/billing/claims/${id}/pay`, paymentData);
  return response.data;
};

/**
 * Create a Razorpay payment order for a claim
 * POST /api/patient-portal/billing/claims/{id}/razorpay-order
 * Returns: { orderId, amount, currency, keyId, claimId, patientName }
 */
export const createRazorpayOrder = async (claimId) => {
  const response = await client.post(`/api/patient-portal/billing/claims/${claimId}/razorpay-order`);
  return response.data;
};

/**
 * Verify Razorpay payment signature and settle the claim as PAID
 * POST /api/patient-portal/billing/claims/{id}/razorpay-verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
export const verifyRazorpayPayment = async (claimId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const response = await client.post(`/api/patient-portal/billing/claims/${claimId}/razorpay-verify`, {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  return response.data;
};

export default {
  getClaims,
  getClaimById,
  createClaim,
  updateClaim,
  submitClaim,
  denyClaim,
  appealClaim,
  voidClaim,
  getPatientClaims,
  validateCoverageCard,
  submitClaimsBatch,
  searchPatients,
  payPatientClaim,
  createRazorpayOrder,
  verifyRazorpayPayment,
};
