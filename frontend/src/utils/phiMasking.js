/**
 * phiMasking.js
 * ─────────────────────────────────────────────────────────
 * Field-level PHI Masking utility.
 * Applies PHI data masking ONLY for MANAGER and VIEWER roles.
 * Full unmasked PHI remains visible for ADMIN, PARAMEDIC, PHYSICIAN, QA_REVIEWER, and PATIENT.
 * ─────────────────────────────────────────────────────────
 */

/**
 * Check if the given user role requires PHI masking.
 * Returns true ONLY for MANAGER and VIEWER roles.
 */
export function isRoleMasked(role) {
  if (!role) return false;
  const r = String(role).toUpperCase().trim();
  return r === 'MANAGER' || r === 'VIEWER';
}

/**
 * Mask Phone Number for restricted roles.
 * Example: "867-555-1234" -> "***-***-1234"
 */
export function maskPhone(phone, role) {
  if (!phone || !isRoleMasked(role)) return phone;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 4) {
    return `***-***-${digits.slice(-4)}`;
  }
  return '***-***-****';
}

/**
 * Mask Patient Address for restricted roles.
 * Example: "123 Franklin Ave, Yellowknife" -> "[Restricted - Address Masked]"
 */
export function maskAddress(address, role) {
  if (!address || !isRoleMasked(role)) return address;
  return '[Restricted Address]';
}

/**
 * Mask Date of Birth for restricted roles.
 * Example: "1985-04-12" -> "****-**-12" (keeps birth day/year obscured)
 */
export function maskDob(dob, role) {
  if (!dob || !isRoleMasked(role)) return dob;
  const str = String(dob);
  if (str.length >= 10) {
    return `****-**-${str.slice(8, 10)}`;
  }
  return '****-**-**';
}

/**
 * Mask Patient Name for restricted roles.
 * Example: "John Doe" -> "J*** D***"
 */
export function maskName(name, role) {
  if (!name || !isRoleMasked(role)) return name;
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1 && parts[0]) {
    return `${parts[0][0]}***`;
  }
  if (parts.length >= 2) {
    return `${parts[0][0]}*** ${parts[parts.length - 1][0]}***`;
  }
  return '*** ***';
}

/**
 * Mask SSN / Health Card Number for restricted roles.
 * Example: "123456789" -> "***-**-6789"
 */
export function maskHealthNumber(hn, role) {
  if (!hn || !isRoleMasked(role)) return hn;
  const str = String(hn);
  if (str.length >= 4) {
    return `***-**-${str.slice(-4)}`;
  }
  return '***-**-****';
}
