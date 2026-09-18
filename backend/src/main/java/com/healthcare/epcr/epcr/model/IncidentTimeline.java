package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IncidentTimeline {
    private LocalDateTime callReceivedAt;
    private LocalDateTime dispatchedAt;
    private LocalDateTime enRouteAt;
    private LocalDateTime arrivedSceneAt;
    private LocalDateTime patientContactAt;
    private LocalDateTime departedSceneAt;
    private LocalDateTime arrivedDestinationAt;
    private LocalDateTime transferOfCareAt;
    private LocalDateTime unitAvailableAt;
    private Long responseTimeMinutes;
    private Long sceneTimeMinutes;
    private Long transportTimeMinutes;
    private Long totalCallTimeMinutes;
}
