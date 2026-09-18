package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChiefComplaint {
    private String complaint;
    private String onset;
    private LocalDateTime onsetTime;
    private String provocation;
    private String quality;
    private String radiation;
    private Integer severity;
    private String timing;
    private String associatedSymptoms;
    private Boolean traumaRelated;
}
