package com.healthcare.epcr.rulesengine.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.rulesengine.dto.RunRulesResponse;
import com.healthcare.epcr.rulesengine.dto.RuleMatchResult;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
@Slf4j
public class IfThenLogicService {
    private static final Set<String> SUPPORTED_FIELDS = Set.of(
            "age", "spo2", "heartRate", "pulseRate", "respirationRate",
            "systolicBp", "diastolicBp", "temperature", "bloodSugar",
            "hemoglobin", "weight", "height", "location"
    );

    private static final Map<String, String> FIELD_ALIASES = Map.of(
            "location", "incidentLocation"
    );

    private final IfThenRuleRepository ruleRepository;
    private final PatientCareRecordRepository recordRepository;
    private final AccessControlService accessControlService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final PhiCryptoService phiCryptoService;

    public IfThenRule createRule(IfThenRule rule) {
        User currentUser = accessControlService.currentUser();
        validateRule(rule);
        String organizationId = resolveOrganizationId(rule.getOrganizationId(), currentUser);
        rule.setOrganizationId(organizationId);
        if (rule.getActive() == null) {
            rule.setActive(true);
        }
        rule.setCreatedAt(LocalDateTime.now());
        rule.setUpdatedAt(LocalDateTime.now());
        return ruleRepository.save(rule);
    }

    public List<IfThenRule> listRules(String organizationId) {
        User currentUser = accessControlService.currentUser();
        return ruleRepository.findByOrganizationIdOrderByCreatedAtDesc(resolveOrganizationId(organizationId, currentUser));
    }

    public Set<String> supportedFields() {
        return new TreeSet<>(SUPPORTED_FIELDS);
    }

    public RunRulesResponse runForAccessibleRecords(String organizationId, boolean dryRun) {
        return runForAccessibleRecords(organizationId, dryRun, null, null, null);
    }

    public RunRulesResponse runForAccessibleRecords(
            String organizationId,
            boolean dryRun,
            List<String> ruleIds,
            List<String> patientIds,
            List<String> recordIds) {
        User currentUser = accessControlService.currentUser();
        String scopedOrganizationId = resolveOrganizationId(organizationId, currentUser);
        List<PatientCareRecord> records = recordRepository.findByOrganizationId(scopedOrganizationId);
        return evaluate(records, scopedOrganizationId, dryRun, new MatchSelection(ruleIds, patientIds, recordIds));
    }

    public RunRulesResponse runForPatient(String patientId, boolean dryRun) {
        if (patientId == null || patientId.isBlank()) {
            throw new IllegalArgumentException("patientId is required");
        }
        List<PatientCareRecord> records = recordRepository.findByPatientId(patientId).stream()
                .filter(record -> accessControlService.canAccessOrganization(record.getOrganizationId()))
                .toList();
        if (records.isEmpty()) {
            throw new ResourceNotFoundException("No accessible records found for patientId: " + patientId);
        }
        String organizationId = records.getFirst().getOrganizationId();
        return evaluate(records, organizationId, dryRun);
    }

    public RunRulesResponse runForRecord(PatientCareRecord record, boolean dryRun) {
        if (record == null || record.getOrganizationId() == null) {
            return new RunRulesResponse(dryRun, 0, 0, 0, new ArrayList<>());
        }
        return evaluate(List.of(record), record.getOrganizationId(), dryRun);
    }

    private RunRulesResponse evaluate(List<PatientCareRecord> records, String organizationId, boolean dryRun) {
        return evaluate(records, organizationId, dryRun, MatchSelection.empty());
    }

    private RunRulesResponse evaluate(
            List<PatientCareRecord> records,
            String organizationId,
            boolean dryRun,
            MatchSelection selection) {
         List<IfThenRule> rules = ruleRepository.findByOrganizationIdAndActiveTrue(organizationId);
         if (selection.hasRuleFilter()) {
             rules = rules.stream()
                     .filter(rule -> selection.matchesRule(rule))
                     .toList();
         }
         RunRulesResponse response = new RunRulesResponse(dryRun, records.size(), rules.size(), 0, new ArrayList<>());
         for (PatientCareRecord record : records) {
             for (IfThenRule rule : rules) {
                 // Handle PATIENT_SPECIFIC rules
                 if ("PATIENT_SPECIFIC".equals(rule.getRuleType())) {
                     if (rule.getPatientId() == null || !rule.getPatientId().equals(record.getPatientId())) {
                         continue;
                     }
                     // Patient-specific rule matched
                     RuleMatchResult result = new RuleMatchResult(
                             rule.getId(),
                             rule.getName(),
                             record.getId(),
                             record.getPatientId(),
                             decrypt(record.getPatientName()),
                             "patientId",
                             record.getPatientId(),
                             "=",
                             rule.getPatientId(),
                             rule.getAction() == null ? null : rule.getAction().getType(),
                             false,
                             dryRun ? "MATCHED_DRY_RUN" : "MATCHED"
                     );
                     if (!dryRun && selection.shouldExecute(rule, record)) {
                         executeAction(rule, record, record.getPatientId());
                         result.setActionExecuted(true);
                         result.setStatus("EXECUTED");
                     } else if (!dryRun) {
                         result.setStatus("MATCHED_NOT_SELECTED");
                     }
                     response.getMatches().add(result);
                 } else {
                     // Handle FIELD_BASED rules. Multiple conditions are combined with AND.
                     List<ConditionEvaluation> evaluations = evaluateConditions(rule, record);
                     if (evaluations.isEmpty() || evaluations.stream().anyMatch(evaluation -> !evaluation.matched())) {
                         continue;
                     }
                     Object actual = renderActualValue(evaluations);
                     RuleMatchResult result = new RuleMatchResult(
                             rule.getId(),
                             rule.getName(),
                             record.getId(),
                             record.getPatientId(),
                             decrypt(record.getPatientName()),
                             renderMatchedField(rule, evaluations),
                             actual,
                             renderMatchedOperator(rule, evaluations),
                             renderMatchedThreshold(rule, evaluations),
                             rule.getAction() == null ? null : rule.getAction().getType(),
                             false,
                             dryRun ? "MATCHED_DRY_RUN" : "MATCHED"
                     );
                     if (!dryRun && selection.shouldExecute(rule, record)) {
                         executeAction(rule, record, actual);
                         result.setActionExecuted(true);
                         result.setStatus("EXECUTED");
                     } else if (!dryRun) {
                         result.setStatus("MATCHED_NOT_SELECTED");
                     }
                     response.getMatches().add(result);
                 }
             }
         }
         response.setMatchedRules(response.getMatches().size());
         return response;
     }

    private void executeAction(IfThenRule rule, PatientCareRecord record, Object actual) {
         IfThenAction action = rule.getAction();
         if (action == null || action.getType() == null || action.getType().isBlank()) {
             return;
         }
         String type = action.getType().trim().toUpperCase(Locale.ROOT);
         switch (type) {
             case "EMAIL" -> sendEmailAction(rule, action, record, actual);
             case "FULL_BODY_CHECKUP" -> sendFullBodyCheckupEmail(rule, action, record, actual);
             case "NOTIFY" -> sendNotificationAction(rule, action, record, actual);
             case "FLAG" -> flagRecord(rule, record, actual);
             default -> throw new IllegalArgumentException("Unsupported action type: " + action.getType());
         }
     }

    private void sendEmailAction(IfThenRule rule, IfThenAction action, PatientCareRecord record, Object actual) {
         for (String recipient : resolveEmailRecipients(action, record)) {
             emailService.sendEmail(
                     recipient,
                     render(firstNonBlank(action.getSubject(), "ePCR Rule Alert: {patientName}"), rule, record, actual),
                     render(firstNonBlank(action.getBody(), "Rule {ruleName} matched for {patientName}. {field}={value}"), rule, record, actual)
             );
         }
     }

    private void sendFullBodyCheckupEmail(IfThenRule rule, IfThenAction action, PatientCareRecord record, Object actual) {
        String patientEmail = decrypt(record.getEmail());
        if (patientEmail == null || patientEmail.isBlank()) {
            log.warn("Patient email not available for patient: {}", record.getPatientId());
            return;
        }

        String checkupType = action.getCheckupType() != null ? action.getCheckupType() : "Standard";
        String checkupSchedule = action.getCheckupSchedule() != null ? action.getCheckupSchedule() : "Within 30 days";
        String patientName = decrypt(record.getPatientName());

        String subject = "You are invited for a Full Body Checkup - " + checkupType;
        String body = buildFullBodyCheckupEmail(patientName, checkupType, checkupSchedule);

        emailService.sendEmail(patientEmail, subject, body);
    }

    private String buildFullBodyCheckupEmail(String patientName, String checkupType, String checkupSchedule) {
        return String.format("""
                Dear %s,

                We are pleased to invite you for a comprehensive Full Body Checkup.

                Checkup Type: %s
                Recommended Schedule: %s

                A Full Body Checkup includes:
                - Complete Blood Test
                - Physical Examination
                - Vital Signs Assessment
                - Health Consultation with our Medical Team

                To schedule your appointment, please:
                1. Log in to the ePCR Patient Portal
                2. Navigate to "Health Checkups" section
                3. Select your preferred date and time

                If you have any questions or need assistance, please contact our customer support team.

                Best regards,
                Healthcare ePCR Team
                """, patientName, checkupType, checkupSchedule);
    }

    private void sendNotificationAction(IfThenRule rule, IfThenAction action, PatientCareRecord record, Object actual) {
        for (User recipient : resolveUsers(action, record)) {
            Notification notification = new Notification();
            notification.setRecipientId(recipient.getId());
            notification.setType(firstNonBlank(action.getSeverity(), "WARNING").toUpperCase(Locale.ROOT));
            notification.setTitle(render(firstNonBlank(action.getTitle(), action.getSubject(), "ePCR Rule Alert"), rule, record, actual));
            notification.setMessage(render(firstNonBlank(action.getMessage(), action.getBody(), "Rule {ruleName} matched for {patientName}."), rule, record, actual));
            notification.setRelatedEntityId(record.getId());
            notification.setRelatedEntityType("PatientCareRecord");
            notificationService.createNotification(notification);
        }
    }

    private void flagRecord(IfThenRule rule, PatientCareRecord record, Object actual) {
        Map<String, Object> dynamic = record.getDynamicFormResponses();
        if (dynamic == null) {
            dynamic = new HashMap<>();
            record.setDynamicFormResponses(dynamic);
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> flags = dynamic.get("ifThenFlags") instanceof List<?> existing
                ? (List<Map<String, Object>>) existing
                : new ArrayList<>();
        Map<String, Object> flag = new HashMap<>();
        flag.put("ruleId", rule.getId());
        flag.put("ruleName", rule.getName());
        flag.put("field", rule.getField());
        flag.put("actualValue", actual);
        flag.put("operator", rule.getOperator());
        flag.put("threshold", rule.getThreshold());
        flag.put("conditions", effectiveConditions(rule));
        flag.put("createdAt", LocalDateTime.now());
        flags.add(flag);
        dynamic.put("ifThenFlags", flags);
        record.setUpdatedAt(LocalDateTime.now());
        recordRepository.save(record);
    }

    private Object resolveFieldValue(String field, PatientCareRecord record) {
        if (field == null || field.isBlank()) {
            return null;
        }
        String normalized = normalizeField(field);
        if (normalized.startsWith("clinicalData.") && record.getClinicalData() != null) {
            return record.getClinicalData().get(normalized.substring("clinicalData.".length()));
        }
        if (normalized.startsWith("dynamicFormResponses.") && record.getDynamicFormResponses() != null) {
            return record.getDynamicFormResponses().get(normalized.substring("dynamicFormResponses.".length()));
        }
        if (!isSupportedField(normalized)) {
            throw new IllegalArgumentException("Unsupported rule field: " + normalized);
        }
        BeanWrapperImpl wrapper = new BeanWrapperImpl(record);
        Object value = wrapper.getPropertyValue(normalized);
        return value instanceof String str ? decrypt(str) : value;
    }

    private List<ConditionEvaluation> evaluateConditions(IfThenRule rule, PatientCareRecord record) {
        return effectiveConditions(rule).stream()
                .map(condition -> {
                    Object actual = resolveFieldValue(condition.getField(), record);
                    boolean matched = matches(condition.getOperator(), actual, condition.getThreshold());
                    return new ConditionEvaluation(condition, actual, matched);
                })
                .toList();
    }

    private List<IfThenCondition> effectiveConditions(IfThenRule rule) {
        if (rule.getConditions() != null && !rule.getConditions().isEmpty()) {
            return rule.getConditions();
        }
        if (rule.getField() == null || rule.getField().isBlank()
                || rule.getOperator() == null || rule.getOperator().isBlank()
                || rule.getThreshold() == null || rule.getThreshold().isBlank()) {
            return List.of();
        }
        return List.of(new IfThenCondition(rule.getField(), rule.getOperator(), rule.getThreshold()));
    }

    private String renderMatchedField(IfThenRule rule, List<ConditionEvaluation> evaluations) {
        if (evaluations.size() == 1) {
            return evaluations.getFirst().condition().getField();
        }
        return "conditions";
    }

    private String renderMatchedOperator(IfThenRule rule, List<ConditionEvaluation> evaluations) {
        if (evaluations.size() == 1) {
            return evaluations.getFirst().condition().getOperator();
        }
        return "AND";
    }

    private String renderMatchedThreshold(IfThenRule rule, List<ConditionEvaluation> evaluations) {
        if (evaluations.size() == 1) {
            return evaluations.getFirst().condition().getThreshold();
        }
        return evaluations.stream()
                .map(evaluation -> "%s %s %s".formatted(
                        evaluation.condition().getField(),
                        evaluation.condition().getOperator(),
                        evaluation.condition().getThreshold()))
                .reduce((left, right) -> left + " AND " + right)
                .orElse("");
    }

    private Object renderActualValue(List<ConditionEvaluation> evaluations) {
        if (evaluations.size() == 1) {
            return evaluations.getFirst().actual();
        }
        Map<String, Object> values = new HashMap<>();
        for (ConditionEvaluation evaluation : evaluations) {
            values.put(evaluation.condition().getField(), evaluation.actual());
        }
        return values;
    }

    private boolean matches(String operator, Object actual, String threshold) {
        if (operator == null || actual == null || threshold == null) {
            return false;
        }
        String op = operator.trim().toUpperCase(Locale.ROOT);
        Double actualNumber = toDouble(actual);
        Double thresholdNumber = toDouble(threshold);
        if (actualNumber != null && thresholdNumber != null) {
            return switch (op) {
                case ">", "GT" -> actualNumber > thresholdNumber;
                case ">=", "GTE" -> actualNumber >= thresholdNumber;
                case "<", "LT" -> actualNumber < thresholdNumber;
                case "<=", "LTE" -> actualNumber <= thresholdNumber;
                case "=", "==", "EQ" -> actualNumber.doubleValue() == thresholdNumber.doubleValue();
                case "!=", "NEQ" -> actualNumber.doubleValue() != thresholdNumber.doubleValue();
                default -> false;
            };
        }
        int comparison = String.valueOf(actual).compareToIgnoreCase(threshold);
        return switch (op) {
            case "=", "==", "EQ" -> comparison == 0;
            case "!=", "NEQ" -> comparison != 0;
            default -> false;
        };
    }

    private List<String> resolveEmailRecipients(IfThenAction action, PatientCareRecord record) {
        Set<String> recipients = new LinkedHashSet<>();
        if (Boolean.TRUE.equals(action.getSendToPatient())) {
            String email = decrypt(record.getEmail());
            if (email != null && !email.isBlank()) {
                recipients.add(email);
            }
        }
        if (action.getTo() != null && !action.getTo().isBlank()) {
            String renderedTo = render(action.getTo(), null, record, null);
            if ("patient".equalsIgnoreCase(renderedTo)) {
                String email = decrypt(record.getEmail());
                if (email != null && !email.isBlank()) {
                    recipients.add(email);
                }
            } else {
                addEmailRecipients(recipients, renderedTo);
            }
        }
        if (action.getToEmails() != null) {
            action.getToEmails().stream()
                    .filter(email -> email != null && !email.isBlank())
                    .map(email -> render(email, null, record, null))
                    .forEach(email -> addEmailRecipients(recipients, email));
        }
        resolveUsers(action, record).stream()
                .map(User::getEmail)
                .filter(email -> email != null && !email.isBlank())
                .forEach(recipients::add);
        return new ArrayList<>(recipients);
    }

    private void addEmailRecipients(Set<String> recipients, String rawRecipients) {
        if (rawRecipients == null || rawRecipients.isBlank()) {
            return;
        }
        for (String email : rawRecipients.split("[,;]")) {
            String normalized = email.trim();
            if (!normalized.isBlank()) {
                recipients.add(normalized);
            }
        }
    }

    private List<User> resolveUsers(IfThenAction action, PatientCareRecord record) {
        if (action.getRecipientRoles() == null || action.getRecipientRoles().isEmpty()) {
            return List.of();
        }
        List<User> users = new ArrayList<>();
        for (String roleValue : action.getRecipientRoles()) {
            try {
                Role role = Role.valueOf(roleValue.trim().toUpperCase(Locale.ROOT));
                users.addAll(userRepository.findByOrganizationIdAndRole(record.getOrganizationId(), role));
            } catch (RuntimeException ex) {
                log.warn("Ignoring invalid rule recipient role '{}'", roleValue);
            }
        }
        return users.stream()
                .filter(user -> Boolean.TRUE.equals(user.getActive()))
                .distinct()
                .toList();
    }

    private String render(String template, IfThenRule rule, PatientCareRecord record, Object actual) {
        if (template == null) {
            return null;
        }
        return template
                .replace("{ruleName}", safeToken(rule == null ? null : rule.getName()))
                .replace("{patientName}", safeToken(decrypt(firstNonBlank(record.getPatientName(), "Unknown Patient"))))
                .replace("{age}", record.getAge() == null ? "" : String.valueOf(record.getAge()))
                .replace("{field}", safeToken(rule == null ? null : rule.getField()))
                .replace("{vitalsField}", safeToken(rule == null ? null : rule.getField()))
                .replace("{value}", actual == null ? "" : String.valueOf(actual))
                .replace("{threshold}", safeToken(rule == null ? null : rule.getThreshold()))
                .replace("{thresholdValue}", safeToken(rule == null ? null : rule.getThreshold()))
                .replace("{conditionOperator}", safeToken(rule == null ? null : rule.getOperator()))
                .replace("{patientId}", safeToken(record.getPatientId()))
                .replace("{recordId}", safeToken(record.getId()))
                .replace("{incidentNumber}", safeToken(record.getIncidentNumber()));
    }

    private void validateRule(IfThenRule rule) {
         if (rule == null) {
             throw new IllegalArgumentException("rule payload is required");
         }
         if (rule.getName() == null || rule.getName().isBlank()) {
             throw new IllegalArgumentException("name is required");
         }

         // Determine rule type
         String ruleType = rule.getRuleType() == null ? "FIELD_BASED" : rule.getRuleType().trim().toUpperCase();
         rule.setRuleType(ruleType);

         if ("PATIENT_SPECIFIC".equals(ruleType)) {
             // For patient-specific rules, only patientId is required
             if (rule.getPatientId() == null || rule.getPatientId().isBlank()) {
                 throw new IllegalArgumentException("patientId is required for PATIENT_SPECIFIC rules");
             }
         } else {
             List<IfThenCondition> conditions = effectiveConditions(rule);
             if (conditions.isEmpty()) {
                 throw new IllegalArgumentException("field/operator/threshold or conditions[] is required");
             }
             for (IfThenCondition condition : conditions) {
                 validateCondition(condition);
             }
             if ((rule.getField() == null || rule.getField().isBlank()) && !conditions.isEmpty()) {
                 IfThenCondition firstCondition = conditions.getFirst();
                 rule.setField(firstCondition.getField());
                 rule.setOperator(firstCondition.getOperator());
                 rule.setThreshold(firstCondition.getThreshold());
             }
         }

         if (rule.getAction() == null || rule.getAction().getType() == null || rule.getAction().getType().isBlank()) {
             throw new IllegalArgumentException("action.type is required");
         }
     }

    private void validateCondition(IfThenCondition condition) {
        if (condition == null) {
            throw new IllegalArgumentException("condition is required");
        }
        if (condition.getField() == null || condition.getField().isBlank()) {
            throw new IllegalArgumentException("condition.field is required");
        }
        String field = condition.getField().trim();
        if (!isSupportedField(field)) {
            throw new IllegalArgumentException("Unsupported rule field: " + field);
        }
        if (condition.getOperator() == null || condition.getOperator().isBlank()) {
            throw new IllegalArgumentException("condition.operator is required");
        }
        if (condition.getThreshold() == null || condition.getThreshold().isBlank()) {
            throw new IllegalArgumentException("condition.threshold is required");
        }
    }

    private String resolveOrganizationId(String requestedOrganizationId, User currentUser) {
        if (requestedOrganizationId != null && !requestedOrganizationId.isBlank()) {
            accessControlService.assertOrganizationAccess(requestedOrganizationId);
            return requestedOrganizationId;
        }
        if (currentUser.getOrganizationId() == null || currentUser.getOrganizationId().isBlank()) {
            throw new IllegalArgumentException("organizationId is required for this user");
        }
        accessControlService.assertOrganizationAccess(currentUser.getOrganizationId());
        return currentUser.getOrganizationId();
    }

    private String decrypt(String value) {
        return phiCryptoService.decrypt(value);
    }

    private Double toDouble(Object value) {
        try {
            return Double.parseDouble(String.valueOf(value).replace("%", "").trim());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String safeToken(String value) {
        return value == null ? "" : value;
    }

    private boolean isSupportedField(String field) {
        if (field == null || field.isBlank()) {
            return false;
        }
        String normalized = normalizeField(field);
        return SUPPORTED_FIELDS.contains(normalized)
                || normalized.startsWith("clinicalData.")
                || normalized.startsWith("dynamicFormResponses.")
                || isPatientCareRecordProperty(normalized);
    }

    private String normalizeField(String field) {
        if (field == null) {
            return null;
        }
        String normalized = field.trim();
        return FIELD_ALIASES.getOrDefault(normalized, normalized);
    }

    private boolean isPatientCareRecordProperty(String field) {
        if ("class".equals(field)) {
            return false;
        }
        return new BeanWrapperImpl(PatientCareRecord.class).isReadableProperty(field);
    }

    private record ConditionEvaluation(IfThenCondition condition, Object actual, boolean matched) {
    }

    private record MatchSelection(Set<String> ruleIds, Set<String> patientIds, Set<String> recordIds) {
        private MatchSelection(List<String> ruleIds, List<String> patientIds, List<String> recordIds) {
            this(toNormalizedSet(ruleIds), toNormalizedSet(patientIds), toNormalizedSet(recordIds));
        }

        private static MatchSelection empty() {
            return new MatchSelection(Set.of(), Set.of(), Set.of());
        }

        private boolean hasRuleFilter() {
            return !ruleIds.isEmpty();
        }

        private boolean shouldExecute(IfThenRule rule, PatientCareRecord record) {
            return matchesRule(rule)
                    && matchesPatient(record)
                    && matchesRecord(record);
        }

        private boolean matchesRule(IfThenRule rule) {
            return ruleIds.isEmpty() || (rule != null && ruleIds.contains(rule.getId()));
        }

        private boolean matchesPatient(PatientCareRecord record) {
            return patientIds.isEmpty() || (record != null && patientIds.contains(record.getPatientId()));
        }

        private boolean matchesRecord(PatientCareRecord record) {
            return recordIds.isEmpty() || (record != null && recordIds.contains(record.getId()));
        }

        private static Set<String> toNormalizedSet(List<String> values) {
            if (values == null || values.isEmpty()) {
                return Set.of();
            }
            Set<String> normalized = new LinkedHashSet<>();
            for (String value : values) {
                if (value != null && !value.isBlank()) {
                    normalized.add(value.trim());
                }
            }
            return normalized;
        }
    }
}
