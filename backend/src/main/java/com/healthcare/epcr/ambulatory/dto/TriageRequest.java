package com.healthcare.epcr.ambulatory.dto;

import lombok.Data;

import java.util.Map;

/**
 * Request body for PUT /api/ambulatory/referrals/{id}/triage.
 *
 * Contains the 4-domain accreditation-standard checklist maps.
 * Each map is schema-validated against FormEngine template
 * "ambulatory-referral-triage-v1" — same pattern used by
 * LTC Supportive Pathways and Rehab ASD/FASD assessments.
 *
 * triageScore is NOT accepted from the client — it is computed
 * server-side in AmbulatoryReferralService.computeTriageScore().
 */
@Data
public class TriageRequest {

    /** Physical health needs checklist items. */
    private Map<String, Object> physicalNeeds;

    /** Emotional / mental health needs checklist items. */
    private Map<String, Object> emotionalNeeds;

    /** Psychosocial determinants (housing, social support, etc.). */
    private Map<String, Object> psychosocialNeeds;

    /** Educational or literacy-related needs. */
    private Map<String, Object> educationalNeeds;
}
