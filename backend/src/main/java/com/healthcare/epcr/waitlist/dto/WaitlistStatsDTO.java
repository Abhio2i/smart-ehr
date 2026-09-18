package com.healthcare.epcr.waitlist.dto;

import lombok.Data;

/** Aggregate statistics for a waitlist, scoped to an organization. */
@Data
public class WaitlistStatsDTO {

    private String organizationId;

    /** Total currently waiting entries (status = WAITING) */
    private long totalWaiting;

    /** Entries currently with an open offer (status = OFFERED) */
    private long totalOffered;

    /** Entries that converted to appointments (status = SCHEDULED) */
    private long totalScheduled;

    /** Entries declined by patient (status = DECLINED) */
    private long totalDeclined;

    /** Entries removed or expired (status = REMOVED or EXPIRED) */
    private long totalRemovedOrExpired;

    /** Average time from WAITING to OFFERED in minutes (-1 if unknown) */
    private long avgTimeToOfferMinutes;
}
