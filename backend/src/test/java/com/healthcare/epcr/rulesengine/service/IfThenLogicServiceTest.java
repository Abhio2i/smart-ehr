package com.healthcare.epcr.rulesengine.service;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.rulesengine.dto.RunRulesResponse;
import com.healthcare.epcr.rulesengine.model.IfThenAction;
import com.healthcare.epcr.rulesengine.model.IfThenCondition;
import com.healthcare.epcr.rulesengine.model.IfThenRule;
import com.healthcare.epcr.rulesengine.repository.IfThenRuleRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.notification.service.NotificationService;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IfThenLogicServiceTest {

    @Mock
    private IfThenRuleRepository ruleRepository;
    @Mock
    private PatientCareRecordRepository recordRepository;
    @Mock
    private AccessControlService accessControlService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private EmailService emailService;
    @Mock
    private PhiCryptoService phiCryptoService;

    @InjectMocks
    private IfThenLogicService logicService;

    @BeforeEach
    void setUp() {
        lenient().when(phiCryptoService.decrypt(anyString())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void runForAccessibleRecordsShouldReturnDryRunMatchesWithoutExecutingActions() {
        User currentUser = user("manager-1", "org-1", Role.MANAGER);
        PatientCareRecord record = record("record-1", "patient-1", "org-1", 182);
        IfThenRule rule = rule("rule-1", "High systolic", "systolicBp", ">=", "180", "NOTIFY");

        when(accessControlService.currentUser()).thenReturn(currentUser);
        when(recordRepository.findByOrganizationId("org-1")).thenReturn(List.of(record));
        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        RunRulesResponse response = logicService.runForAccessibleRecords(null, true);

        assertTrue(response.isDryRun());
        assertEquals(1, response.getEvaluatedRecords());
        assertEquals(1, response.getEvaluatedRules());
        assertEquals(1, response.getMatchedRules());
        assertFalse(response.getMatches().getFirst().isActionExecuted());
        assertEquals("MATCHED_DRY_RUN", response.getMatches().getFirst().getStatus());
        verify(notificationService, never()).createNotification(any(Notification.class));
        verify(emailService, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void runForRecordShouldCreateNotificationsForConfiguredRecipientRoles() {
        PatientCareRecord record = record("record-1", "patient-1", "org-1", 91);
        IfThenRule rule = rule("rule-1", "Low SpO2", "spo2", "<", "95", "NOTIFY");
        rule.getAction().setRecipientRoles(List.of("PHYSICIAN"));
        rule.getAction().setTitle("Clinical alert for {patientName}");
        rule.getAction().setMessage("{field} value is {value}");

        User physician = user("physician-1", "org-1", Role.PHYSICIAN);
        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));
        when(userRepository.findByOrganizationIdAndRole("org-1", Role.PHYSICIAN)).thenReturn(List.of(physician));

        RunRulesResponse response = logicService.runForRecord(record, false);

        assertEquals(1, response.getMatchedRules());
        assertTrue(response.getMatches().getFirst().isActionExecuted());

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationService).createNotification(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertEquals("physician-1", notification.getRecipientId());
        assertEquals("WARNING", notification.getType());
        assertEquals("Clinical alert for Jane Patient", notification.getTitle());
        assertEquals("spo2 value is 91.0", notification.getMessage());
        assertEquals("record-1", notification.getRelatedEntityId());
    }

    @Test
    void runForRecordShouldPersistFlagActionOnDynamicResponses() {
        PatientCareRecord record = record("record-1", "patient-1", "org-1", 188);
        IfThenRule rule = rule("rule-1", "High systolic", "systolicBp", ">=", "180", "FLAG");

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        RunRulesResponse response = logicService.runForRecord(record, false);

        assertEquals(1, response.getMatchedRules());
        assertTrue(record.getDynamicFormResponses().containsKey("ifThenFlags"));
        verify(recordRepository).save(record);
    }

    @Test
    void runForRecordShouldSendCampaignEmailToMatchingPatientAndSpecificEmail() {
        PatientCareRecord record = record("record-1", "patient-1", "org-1", 120);
        record.setAge(35);
        record.setEmail("patient@example.com");
        IfThenRule rule = rule("rule-1", "Full body checkup under 40", "age", "<", "40", "EMAIL");
        rule.getAction().setSendToPatient(true);
        rule.getAction().setToEmails(List.of("admin@example.com"));
        rule.getAction().setSubject("Full body checkup reminder for {patientName}");
        rule.getAction().setBody("Hi {patientName}, your age is {age}. Please visit for a full body checkup.");

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        RunRulesResponse response = logicService.runForRecord(record, false);

        assertEquals(1, response.getMatchedRules());
        verify(emailService).sendEmail(
                "patient@example.com",
                "Full body checkup reminder for Jane Patient",
                "Hi Jane Patient, your age is 35. Please visit for a full body checkup.");
        verify(emailService).sendEmail(
                "admin@example.com",
                "Full body checkup reminder for Jane Patient",
                "Hi Jane Patient, your age is 35. Please visit for a full body checkup.");
    }

    @Test
    void runForAccessibleRecordsShouldExecuteEmailOnlyForSelectedPatients() {
        User currentUser = user("manager-1", "org-1", Role.MANAGER);
        PatientCareRecord selectedRecord = record("record-1", "patient-1", "org-1", 120);
        selectedRecord.setAge(35);
        selectedRecord.setEmail("selected@example.com");
        PatientCareRecord skippedRecord = record("record-2", "patient-2", "org-1", 125);
        skippedRecord.setAge(36);
        skippedRecord.setEmail("skipped@example.com");

        IfThenRule rule = rule("rule-1", "Full body checkup under 40", "age", "<", "40", "EMAIL");
        rule.getAction().setSendToPatient(true);
        rule.getAction().setSubject("Full body checkup reminder for {patientName}");
        rule.getAction().setBody("Hi {patientName}, your age is {age}. Please visit for a full body checkup.");

        when(accessControlService.currentUser()).thenReturn(currentUser);
        when(recordRepository.findByOrganizationId("org-1")).thenReturn(List.of(selectedRecord, skippedRecord));
        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        RunRulesResponse response = logicService.runForAccessibleRecords(
                null,
                false,
                List.of("rule-1"),
                List.of("patient-1"),
                null);

        assertEquals(2, response.getMatchedRules());
        assertTrue(response.getMatches().stream()
                .anyMatch(match -> "patient-1".equals(match.getPatientId())
                        && match.isActionExecuted()
                        && "EXECUTED".equals(match.getStatus())));
        assertTrue(response.getMatches().stream()
                .anyMatch(match -> "patient-2".equals(match.getPatientId())
                        && !match.isActionExecuted()
                        && "MATCHED_NOT_SELECTED".equals(match.getStatus())));

        ArgumentCaptor<String> emailCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendEmail(emailCaptor.capture(), anyString(), anyString());
        assertEquals(List.of("selected@example.com"), emailCaptor.getAllValues());
    }

    @Test
    void runForRecordShouldMatchOnlyWhenAllConditionsAreTrue() {
        PatientCareRecord matchingRecord = record("record-1", "patient-1", "org-1", 120);
        matchingRecord.setAge(45);
        matchingRecord.setSpo2(91.0);

        PatientCareRecord nonMatchingRecord = record("record-2", "patient-2", "org-1", 120);
        nonMatchingRecord.setAge(35);
        nonMatchingRecord.setSpo2(91.0);

        IfThenRule rule = rule("rule-1", "Age above 40 with low SpO2", null, null, null, "NOTIFY");
        rule.setConditions(List.of(
                new IfThenCondition("age", ">", "40"),
                new IfThenCondition("spo2", "<", "94")
        ));

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        RunRulesResponse matchingResponse = logicService.runForRecord(matchingRecord, true);
        RunRulesResponse nonMatchingResponse = logicService.runForRecord(nonMatchingRecord, true);

        assertEquals(1, matchingResponse.getMatchedRules());
        assertEquals("conditions", matchingResponse.getMatches().getFirst().getField());
        assertEquals("AND", matchingResponse.getMatches().getFirst().getOperator());
        assertEquals("age > 40 AND spo2 < 94", matchingResponse.getMatches().getFirst().getThreshold());
        assertEquals(0, nonMatchingResponse.getMatchedRules());
    }

    @Test
    void createRuleShouldAcceptConditionsWithoutLegacySingleConditionFields() {
        User currentUser = user("manager-1", "org-1", Role.MANAGER);
        IfThenRule rule = rule("rule-1", "Age above 40 with low SpO2", null, null, null, "EMAIL");
        rule.setConditions(List.of(
                new IfThenCondition("age", ">", "40"),
                new IfThenCondition("spo2", "<", "94")
        ));

        when(accessControlService.currentUser()).thenReturn(currentUser);
        when(ruleRepository.save(rule)).thenReturn(rule);

        IfThenRule saved = logicService.createRule(rule);

        assertEquals("age", saved.getField());
        assertEquals(">", saved.getOperator());
        assertEquals("40", saved.getThreshold());
        assertEquals(2, saved.getConditions().size());
        verify(ruleRepository).save(rule);
    }

    @Test
    void supportedFieldsShouldReturnOnlyRealLifeDropdownFields() {
        assertEquals(List.of(
                "age",
                "bloodSugar",
                "diastolicBp",
                "heartRate",
                "height",
                "hemoglobin",
                "location",
                "pulseRate",
                "respirationRate",
                "spo2",
                "systolicBp",
                "temperature",
                "weight"
        ), logicService.supportedFields().stream().toList());
    }

    @Test
    void runForRecordShouldSupportLocationAsIncidentLocationCriteria() {
        PatientCareRecord record = record("record-1", "patient-1", "org-1", 120);
        record.setIncidentLocation("Downtown Clinic");
        IfThenRule rule = rule("rule-1", "Downtown clinic campaign", "location", "=", "Downtown Clinic", "NOTIFY");

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        RunRulesResponse response = logicService.runForRecord(record, true);

        assertEquals(1, response.getMatchedRules());
        assertEquals("location", response.getMatches().getFirst().getField());
        assertEquals("Downtown Clinic", response.getMatches().getFirst().getValue());
    }

    @Test
    void runForRecordShouldSupportReadablePatientCareRecordFieldsWithoutAllowlistEdit() {
        PatientCareRecord record = record("record-1", "patient-1", "org-1", 120);
        record.setDiagnosis("Asthma");
        IfThenRule rule = rule("rule-1", "Diagnosis campaign", "diagnosis", "=", "Asthma", "NOTIFY");

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        RunRulesResponse response = logicService.runForRecord(record, true);

        assertEquals(1, response.getMatchedRules());
        assertEquals("diagnosis", response.getMatches().getFirst().getField());
        assertEquals("Asthma", response.getMatches().getFirst().getValue());
    }

    @Test
    void runForRecordShouldSupportDynamicMapFieldsInConditions() {
        PatientCareRecord record = record("record-1", "patient-1", "org-1", 120);
        record.setClinicalData(Map.of("riskScore", 8));
        record.setDynamicFormResponses(Map.of("smoker", "yes"));
        IfThenRule rule = rule("rule-1", "Dynamic risk campaign", null, null, null, "NOTIFY");
        rule.setConditions(List.of(
                new IfThenCondition("clinicalData.riskScore", ">=", "7"),
                new IfThenCondition("dynamicFormResponses.smoker", "=", "yes")
        ));

        when(ruleRepository.findByOrganizationIdAndActiveTrue("org-1")).thenReturn(List.of(rule));

        RunRulesResponse response = logicService.runForRecord(record, true);

        assertEquals(1, response.getMatchedRules());
        assertEquals("clinicalData.riskScore >= 7 AND dynamicFormResponses.smoker = yes",
                response.getMatches().getFirst().getThreshold());
    }

    private PatientCareRecord record(String id, String patientId, String organizationId, Integer systolicBp) {
        PatientCareRecord record = new PatientCareRecord();
        record.setId(id);
        record.setPatientId(patientId);
        record.setPatientName("Jane Patient");
        record.setOrganizationId(organizationId);
        record.setSystolicBp(systolicBp);
        record.setSpo2(91.0);
        return record;
    }

    private IfThenRule rule(String id, String name, String field, String operator, String threshold, String actionType) {
        IfThenAction action = new IfThenAction();
        action.setType(actionType);

        IfThenRule rule = new IfThenRule();
        rule.setId(id);
        rule.setName(name);
        rule.setOrganizationId("org-1");
        rule.setField(field);
        rule.setOperator(operator);
        rule.setThreshold(threshold);
        rule.setAction(action);
        rule.setActive(true);
        return rule;
    }

    private User user(String id, String organizationId, Role role) {
        User user = new User();
        user.setId(id);
        user.setOrganizationId(organizationId);
        user.setRole(role);
        user.setActive(true);
        user.setEmail(id + "@example.com");
        return user;
    }
}

