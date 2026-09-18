package com.healthcare.epcr.bed.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;

import java.time.LocalDateTime;

/**
 * Represents a physical hospital bed.
 * Scoped to an organization — Manager and Paramedic can only access
 * beds belonging to their own organizationId.
 */
@Data
@Document(collection = "beds")
@CompoundIndex(name = "bed_unique_per_facility",
        def = "{'bedNumber': 1, 'facilityName': 1, 'organizationId': 1}",
        unique = true)
public class Bed {

    @Id
    private String id;

    private String bedNumber;
    private String roomNumber;
    private String wardName;
    private String facilityName;

    /** Organization this bed belongs to (for multi-tenant scoping). */
    private String organizationId;

    /** UserId of the staff member who registered this bed. */
    private String createdBy;

    private BedStatus status;        // AVAILABLE, OCCUPIED, MAINTENANCE

    private String occupiedByPatientId;
    private String occupiedByPatientName;

    private Integer allottedDays;
    private LocalDateTime releaseDateTime;
    private String assignedBy;

    private LocalDateTime assignedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
