package com.healthcare.epcr.waitlist.enums;

/**
 * Lifecycle states for a waitlist entry.
 *
 * Transitions:
 *   WAITING  → OFFERED (slot becomes available, atomic findAndModify picks this entry)
 *   OFFERED  → SCHEDULED (patient accepts)
 *   OFFERED  → DECLINED  (patient declines — entry is closed)
 *   OFFERED  → WAITING   (offer expires without response — re-queued)
 *   WAITING  → REMOVED   (staff or patient removes the entry manually)
 *   OFFERED  → EXPIRED   (offer window elapsed, intermediate state before re-queue)
 */
public enum WaitlistStatus {
    WAITING,
    OFFERED,
    SCHEDULED,
    EXPIRED,
    REMOVED,
    DECLINED
}
