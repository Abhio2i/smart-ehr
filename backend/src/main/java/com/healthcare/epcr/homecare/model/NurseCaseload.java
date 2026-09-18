package com.healthcare.epcr.homecare.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

/**
 * NurseCaseload — dispatch board's core read model.
 * Tracks which communities a nurse covers and their ordered daily visit list.
 */
@Document(collection = "nurseCaseloads")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NurseCaseload {

    @Id
    private String id;

    @Indexed
    private String nurseId;

    private String nurseName;

    @Indexed
    private String organizationId;

    /** Communities this nurse is responsible for. e.g. ["Fort Liard", "Nahanni Butte"] */
    private List<String> assignedCommunities;

    /** Date this caseload snapshot applies to. */
    @Indexed
    private String date;

    /** Ordered list of HomeCareVisit IDs for the day (route order). */
    private List<String> visitIds;

    /** Max visits this nurse can take per day. */
    private Integer maxDailyVisits;

    /** Whether this nurse is available today (can be marked unavailable for leave). */
    private Boolean available;
}
