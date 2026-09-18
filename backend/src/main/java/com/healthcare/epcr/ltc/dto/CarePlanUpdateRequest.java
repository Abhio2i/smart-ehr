package com.healthcare.epcr.ltc.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CarePlanUpdateRequest {
    private List<String> goals;
    private Map<String, Object> preferences;
    private List<String> dietaryRestrictions;
    private String mobilityLevel;
    private String careNotes;
}
