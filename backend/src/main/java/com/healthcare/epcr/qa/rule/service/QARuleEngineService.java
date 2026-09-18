package com.healthcare.epcr.qa.rule.service;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.qa.rule.model.QAAutoFlagRule;
import com.healthcare.epcr.qa.rule.repository.QAAutoFlagRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class QARuleEngineService {

    private final QAAutoFlagRuleRepository ruleRepository;

    public List<Map<String, Object>> evaluate(String organizationId, PatientCareRecord record) {
        List<QAAutoFlagRule> rules = ruleRepository.findByOrganizationIdAndActiveTrue(organizationId);
        List<Map<String, Object>> flags = new ArrayList<>();
        for (QAAutoFlagRule rule : rules) {
            String actual = resolveFieldValue(rule.getFieldPath(), record);
            if (matches(rule.getOperator(), actual, rule.getExpectedValue())
                    && additionalConditionsMatch(rule, record)) {
                Map<String, Object> flag = new HashMap<>();
                flag.put("ruleId", rule.getId());
                flag.put("ruleName", rule.getName());
                flag.put("severity", rule.getSeverity());
                flag.put("message", rule.getMessage());
                flag.put("fieldPath", rule.getFieldPath());
                flag.put("actualValue", actual);
                flag.put("expectedValue", rule.getExpectedValue());
                flag.put("createdAt", LocalDateTime.now());
                flags.add(flag);
            }
        }
        return flags;
    }

    private boolean additionalConditionsMatch(QAAutoFlagRule rule, PatientCareRecord record) {
        if (rule.getMetadata() == null || rule.getMetadata().isEmpty()) {
            return true;
        }

        Object conditions = rule.getMetadata().get("requiredConditions");
        if (!(conditions instanceof List<?> conditionList) || conditionList.isEmpty()) {
            return true;
        }

        for (Object item : conditionList) {
            if (!(item instanceof Map<?, ?> condition)) {
                return false;
            }

            String fieldPath = stringValue(condition.get("fieldPath"));
            String operator = stringValue(condition.get("operator"));
            String expectedValue = stringValue(condition.get("expectedValue"));
            String actual = resolveFieldValue(fieldPath, record);

            if (!matches(operator, actual, expectedValue)) {
                return false;
            }
        }
        return true;
    }

    private String resolveFieldValue(String fieldPath, PatientCareRecord record) {
        if (fieldPath == null || fieldPath.isBlank()) return null;
        if ("careLevel".equals(fieldPath)) return record.getCareLevel();
        if ("transportMode".equals(fieldPath)) return record.getTransportMode();
        if (fieldPath.startsWith("clinicalData.") && record.getClinicalData() != null) {
            Object value = record.getClinicalData().get(fieldPath.substring("clinicalData.".length()));
            return value == null ? null : String.valueOf(value);
        }
        if (fieldPath.startsWith("dynamicFormResponses.") && record.getDynamicFormResponses() != null) {
            Object value = record.getDynamicFormResponses().get(fieldPath.substring("dynamicFormResponses.".length()));
            return value == null ? null : String.valueOf(value);
        }
        return null;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean matches(String operator, String actual, String expected) {
        if (operator == null || actual == null || expected == null) return false;
        return switch (operator.toUpperCase()) {
            case "EQ" -> actual.equalsIgnoreCase(expected);
            case "NEQ" -> !actual.equalsIgnoreCase(expected);
            case "IN" -> containsExpectedValue(expected, actual);
            case "NOT_IN" -> !containsExpectedValue(expected, actual);
            case "LT" -> toDouble(actual) < toDouble(expected);
            case "LTE" -> toDouble(actual) <= toDouble(expected);
            case "GT" -> toDouble(actual) > toDouble(expected);
            case "GTE" -> toDouble(actual) >= toDouble(expected);
            default -> false;
        };
    }

    private boolean containsExpectedValue(String expectedValues, String actual) {
        return java.util.Arrays.stream(expectedValues.split(","))
                .map(String::trim)
                .anyMatch(value -> value.equalsIgnoreCase(actual.trim()));
    }

    private double toDouble(String value) {
        return Double.parseDouble(value.replace("%", "").trim());
    }
}
