package com.healthcare.epcr.qa.rule.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "qa_auto_flag_rules")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QAAutoFlagRule {
    @Id
    private String id;
    private String organizationId;
    private String name;
    private String fieldPath; // e.g. clinicalData.spo2 or dynamicFormResponses.o2Administered
    private String operator; // LT, LTE, EQ, NEQ, GT, GTE
    private String expectedValue;
    private String severity; // LOW, MEDIUM, HIGH
    private String message;
    private Boolean active;
    private Map<String, Object> metadata;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
