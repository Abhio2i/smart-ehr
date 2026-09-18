package com.healthcare.epcr.rehab.dto;

import java.util.Map;

public class RecordFimAssessmentRequest {

    private Map<String, Integer> items; // 18 items (1 to 7)

    public RecordFimAssessmentRequest() {}

    public Map<String, Integer> getItems() { return items; }
    public void setItems(Map<String, Integer> items) { this.items = items; }
}
