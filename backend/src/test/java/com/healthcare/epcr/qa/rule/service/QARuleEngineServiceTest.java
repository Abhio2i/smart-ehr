package com.healthcare.epcr.qa.rule.service;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.qa.rule.model.QAAutoFlagRule;
import com.healthcare.epcr.qa.rule.repository.QAAutoFlagRuleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QARuleEngineServiceTest {

    @Mock
    private QAAutoFlagRuleRepository ruleRepository;

    @InjectMocks
    private QARuleEngineService ruleEngineService;

    @Test
    void evaluateFlagsEmergencyTransportWhenCareLevelIsNotAls() {
        QAAutoFlagRule rule = emergencyRequiresAlsRule();
        PatientCareRecord record = new PatientCareRecord();
        record.setOrganizationId("org-1");
        record.setTransportMode("EMERGENCY");
        record.setCareLevel("BLS");

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        List<Map<String, Object>> flags = ruleEngineService.evaluate("org-1", record);

        assertEquals(1, flags.size());
        assertEquals("Emergency Transport Requires ALS", flags.get(0).get("ruleName"));
        assertEquals("CRITICAL", flags.get(0).get("severity"));
        assertEquals("BLS", flags.get(0).get("actualValue"));
        assertEquals("ALS,CRITICAL", flags.get(0).get("expectedValue"));
    }

    @Test
    void evaluateDoesNotFlagNonEmergencyTransportWhenCareLevelIsNotAls() {
        QAAutoFlagRule rule = emergencyRequiresAlsRule();
        PatientCareRecord record = new PatientCareRecord();
        record.setOrganizationId("org-1");
        record.setTransportMode("ROUTINE");
        record.setCareLevel("BLS");

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        List<Map<String, Object>> flags = ruleEngineService.evaluate("org-1", record);

        assertEquals(0, flags.size());
    }

    @Test
    void evaluateDoesNotFlagEmergencyTransportWhenCareLevelIsCritical() {
        QAAutoFlagRule rule = emergencyRequiresAlsRule();
        PatientCareRecord record = new PatientCareRecord();
        record.setOrganizationId("org-1");
        record.setTransportMode("EMERGENCY");
        record.setCareLevel("CRITICAL");

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        List<Map<String, Object>> flags = ruleEngineService.evaluate("org-1", record);

        assertEquals(0, flags.size());
    }

    private QAAutoFlagRule emergencyRequiresAlsRule() {
        QAAutoFlagRule rule = new QAAutoFlagRule();
        rule.setId("rule-1");
        rule.setOrganizationId("org-1");
        rule.setName("Emergency Transport Requires ALS");
        rule.setFieldPath("careLevel");
        rule.setOperator("NOT_IN");
        rule.setExpectedValue("ALS,CRITICAL");
        rule.setSeverity("CRITICAL");
        rule.setMessage("Critical Alert: Emergency transport selected but ALS/Critical care level is not documented.");
        rule.setActive(true);
        rule.setMetadata(Map.of(
                "requiredConditions", List.of(Map.of(
                        "fieldPath", "transportMode",
                        "operator", "EQ",
                        "expectedValue", "EMERGENCY"
                ))
        ));
        return rule;
    }
}
