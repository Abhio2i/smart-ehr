package com.healthcare.epcr.rulesengine.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Document(collection = "if_then_rules")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class IfThenRule {
    @Id
    private String id;
    private String organizationId;
    private String name;
    private String ruleType; // FIELD_BASED or PATIENT_SPECIFIC
    private String patientId; // For PATIENT_SPECIFIC rules
    private String field;
    private String operator; // >=, >, <=, <, =, !=, GTE, GT, LTE, LT, EQ, NEQ
    private String threshold;
    private List<IfThenCondition> conditions; // FIELD_BASED rules evaluate all conditions using AND
    private IfThenAction action;
    private Boolean active;
    private Map<String, Object> metadata;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
