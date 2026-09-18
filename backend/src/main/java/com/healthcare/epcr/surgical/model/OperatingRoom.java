package com.healthcare.epcr.surgical.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * OperatingRoom — static resource entity representing a physical OR.
 * Scoped to organization + facility (multi-tenant).
 * CompoundIndex ensures unique room number per facility per org.
 */
@Document(collection = "operatingRooms")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(
    name = "or_unique_per_facility",
    def = "{'roomNumber': 1, 'facilityId': 1, 'organizationId': 1}",
    unique = true
)
public class OperatingRoom {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    @Indexed
    private String facilityId;

    /** e.g. "OR-1", "OR-2" */
    private String roomNumber;

    /** Human-readable name, e.g. "Main Operating Theatre" */
    private String roomName;

    /**
     * Equipment tags available in this OR.
     * e.g. ["LAPAROSCOPY", "C-ARM", "ROBOT_ASSIST", "CARDIAC_BYPASS"]
     */
    private List<String> equipmentTags;

    /** Whether this OR is currently active/usable. */
    private boolean active;

    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}
