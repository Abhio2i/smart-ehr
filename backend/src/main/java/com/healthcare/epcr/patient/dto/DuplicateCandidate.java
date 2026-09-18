package com.healthcare.epcr.patient.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Represents a potential duplicate patient found by DuplicateDetectionService.
 * Returned to the frontend so the user can review before overriding or merging.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DuplicateCandidate {

    /** The patientId of the existing record that may be a duplicate. */
    private String patientId;

    /** The ePCR record ID used to pull the name/DOB. */
    private String recordId;

    /** Full name of the existing patient (decrypted for display). */
    private String patientName;

    /** Date of birth of the existing patient (YYYY-MM-DD). */
    private String dateOfBirth;

    /** Phone number on file. */
    private String phone;

    /** Raw match score (sum of all signals fired). */
    private int score;

    /** Confidence percentage (0-100), derived from score. */
    private double confidence;

    /** Which signals matched (e.g., NAME_PHONETIC, DOB_EXACT, PHONE_MATCH). */
    private List<String> matchedSignals;
}
