package com.healthcare.epcr.bed.model;

/**
 * Represents the operational status of a hospital bed.
 * <ul>
 *   <li>{@link #AVAILABLE}    – Bed is clean and ready for a new patient.</li>
 *   <li>{@link #OCCUPIED}     – A patient is currently assigned to this bed.</li>
 *   <li>{@link #MAINTENANCE}  – Bed is out of service (repair / deep-cleaning).</li>
 * </ul>
 */
public enum BedStatus {
    AVAILABLE,
    OCCUPIED,
    MAINTENANCE
}
