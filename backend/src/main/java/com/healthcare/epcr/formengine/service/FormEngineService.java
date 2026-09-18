package com.healthcare.epcr.formengine.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.epcr.dto.CreatePatientCareRecordRequest;
import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import com.healthcare.epcr.epcr.service.IPatientCareRecordService;
import com.healthcare.epcr.formengine.model.FormSubmission;
import com.healthcare.epcr.formengine.model.FormTemplate;
import com.healthcare.epcr.formengine.repository.FormSubmissionRepository;
import com.healthcare.epcr.formengine.repository.FormTemplateRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.healthcare.epcr.user.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FormEngineService {

    private final FormTemplateRepository formTemplateRepository;
    private final FormSubmissionRepository formSubmissionRepository;
    private final AccessControlService accessControlService;
    private final IPatientCareRecordService patientCareRecordService;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public FormTemplate createTemplate(FormTemplate template) {
        accessControlService.assertOrganizationAccess(template.getOrganizationId());
        if (template.getVersion() == null || template.getVersion() < 1) {
            template.setVersion(1);
        }
        if (template.getPublished() == null) template.setPublished(false);
        if (template.getActive() == null) template.setActive(true);
        template.setCreatedAt(LocalDateTime.now());
        template.setUpdatedAt(LocalDateTime.now());
        return formTemplateRepository.save(template);
    }

    public List<FormTemplate> getTemplatesByOrgAndType(String organizationId, String templateType) {
        accessControlService.assertOrganizationAccess(organizationId);
        return formTemplateRepository.findByOrganizationIdAndTemplateType(organizationId, templateType);
    }

    public FormTemplate getLatestPublishedTemplate(String organizationId, String templateType) {
        accessControlService.assertOrganizationAccess(organizationId);
        return formTemplateRepository
                .findFirstByOrganizationIdAndTemplateTypeAndPublishedTrueAndActiveTrueOrderByVersionDesc(organizationId, templateType)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Published template not found for org=" + organizationId + ", type=" + templateType
                ));
    }

    public FormSubmission submitAgainstTemplate(String templateId, FormSubmission submission) {
        User currentUser = accessControlService.currentUser();
        FormTemplate template = formTemplateRepository.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Form template not found: " + templateId));
        accessControlService.assertOrganizationAccess(template.getOrganizationId());

        if (submission.getId() == null || submission.getId().isBlank()) {
            submission.setId(UUID.randomUUID().toString());
        }
        submission.setTemplateId(template.getId());
        submission.setTemplateVersion(template.getVersion());
        submission.setOrganizationId(template.getOrganizationId());
        submission.setSubmittedBy(currentUser.getId());
        submission.setCreatedAt(LocalDateTime.now());
        submission.setUpdatedAt(LocalDateTime.now());

        if ("EPCR".equalsIgnoreCase(template.getTemplateType())) {
            PatientCareRecordDTO syncedRecord = upsertEpcrFromSubmission(submission);
            submission.setSourceRecordId(syncedRecord.getId());
        }

        return formSubmissionRepository.save(submission);
    }

    public List<FormSubmission> getSubmissionsByOrganization(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return formSubmissionRepository.findByOrganizationId(organizationId);
    }

    private PatientCareRecordDTO upsertEpcrFromSubmission(FormSubmission submission) {
        CreatePatientCareRecordRequest request = toEpcrRequest(submission);
        if (submission.getSourceRecordId() != null && !submission.getSourceRecordId().isBlank()) {
            return patientCareRecordService.updateRecord(submission.getSourceRecordId(), request);
        }
        validateRequiredForCreate(request);
        return patientCareRecordService.createRecord(request);
    }

    @SuppressWarnings("unchecked")
    private CreatePatientCareRecordRequest toEpcrRequest(FormSubmission submission) {
        Map<String, Object> payload = submission.getPayload() == null ? Map.of() : submission.getPayload();
        Map<String, Object> flat = new HashMap<>(payload);

        // Patient Info
        Optional<Map<String, Object>> patientInfo = extractSection(payload, "patientInfo");
        if (patientInfo.isPresent()) {
            Map<String, Object> pi = patientInfo.get();
            putIfMissing(flat, "patientName", joinName(pi.get("firstName"), pi.get("lastName")));
            putIfMissing(flat, "patientDateOfBirth", pi.get("dob"));
            putIfMissing(flat, "patientPhone", pi.get("phone"));
            putIfMissing(flat, "patientAddress", pi.get("address"));
            putIfMissing(flat, "patientId", pi.get("patientId"));
            putIfMissing(flat, "patientGender", pi.get("gender"));
            putIfMissing(flat, "age", pi.get("age"));
            putIfMissing(flat, "email", pi.get("email"));
            putIfMissing(flat, "bloodGroup", pi.get("bloodGroup"));
        }

        // Incident Info
        Optional<Map<String, Object>> incidentInfo = extractSection(payload, "incidentInfo");
        if (incidentInfo.isPresent()) {
            Map<String, Object> ii = incidentInfo.get();
            putIfMissing(flat, "incidentDateTime", ii.get("dateTime"));
            putIfMissing(flat, "incidentLocation", ii.get("location"));
            putIfMissing(flat, "incidentType", ii.get("type"));
            putIfMissing(flat, "incidentDescription", ii.get("description"));
            putIfMissing(flat, "incidentNumber", ii.get("number"));
        }

        // Medical Info
        Optional<Map<String, Object>> medicalInfo = extractSection(payload, "medicalInfo");
        if (medicalInfo.isPresent()) {
            Map<String, Object> mi = medicalInfo.get();
            putIfMissing(flat, "complaints", mi.get("complaints"));
            putIfMissing(flat, "vitals", mi.get("vitals"));
            putIfMissing(flat, "diagnosis", mi.get("diagnosis"));
            putIfMissing(flat, "treatmentProvided", mi.get("treatmentProvided"));
            putIfMissing(flat, "treatmentPlan", mi.get("treatmentPlan"));
            putIfMissing(flat, "medicationsAdministered", mi.get("medications"));
            putIfMissing(flat, "proceduresPerformed", mi.get("procedures"));
            putIfMissing(flat, "primaryImpression", mi.get("primaryImpression"));
            putIfMissing(flat, "secondaryImpression", mi.get("secondaryImpression"));
        }
        
        // Vitals
        Optional<Map<String, Object>> vitals = extractSection(payload, "vitals");
        if (vitals.isPresent()) {
            Map<String, Object> v = vitals.get();
            putIfMissing(flat, "spo2", v.get("spo2"));
            putIfMissing(flat, "respirationRate", v.get("respirationRate"));
            putIfMissing(flat, "bloodSugar", v.get("bloodSugar"));
            putIfMissing(flat, "heartRate", v.get("heartRate"));
            putIfMissing(flat, "diastolicBp", v.get("diastolicBp"));
            putIfMissing(flat, "systolicBp", v.get("systolicBp"));
            putIfMissing(flat, "pulseRate", v.get("pulseRate"));
            putIfMissing(flat, "temperature", v.get("temperature"));
        }

        // Transport
        Optional<Map<String, Object>> transport = extractSection(payload, "transport");
        if (transport.isPresent()) {
            Map<String, Object> t = transport.get();
            putIfMissing(flat, "transportDestination", t.get("destination"));
            putIfMissing(flat, "transportMode", t.get("mode"));
            putIfMissing(flat, "careLevel", t.get("careLevel"));
        }

        putIfMissing(flat, "organizationId", submission.getOrganizationId());
        putIfMissing(flat, "paramedicsId", submission.getSubmittedBy());

        CreatePatientCareRecordRequest request = objectMapper.convertValue(flat, CreatePatientCareRecordRequest.class);

        Map<String, Object> dynamic = new HashMap<>();
        if (request.getDynamicFormResponses() != null) {
            dynamic.putAll(request.getDynamicFormResponses());
        }
        dynamic.put("formSubmissionId", submission.getId());
        dynamic.put("formTemplateId", submission.getTemplateId());
        dynamic.put("formTemplateVersion", submission.getTemplateVersion());
        dynamic.put("formSubmissionPayload", payload);
        request.setDynamicFormResponses(dynamic);
        return request;
    }

    private void validateRequiredForCreate(CreatePatientCareRecordRequest request) {
        if (isBlank(request.getPatientId())
                || isBlank(request.getPatientName())
                || isBlank(request.getPatientDateOfBirth())
                || request.getPatientGender() == null
                || request.getIncidentDateTime() == null
                || isBlank(request.getIncidentLocation())) {
            throw new IllegalArgumentException("EPCR form submission missing required fields for record creation");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private void putIfMissing(Map<String, Object> target, String key, Object value) {
        if (value == null) return;
        Object existing = target.get(key);
        if (existing == null || (existing instanceof String s && s.isBlank())) {
            target.put(key, value);
        }
    }

    private String joinName(Object firstName, Object lastName) {
        String first = firstName == null ? "" : String.valueOf(firstName).trim();
        String last = lastName == null ? "" : String.valueOf(lastName).trim();
        String joined = (first + " " + last).trim();
        return joined.isEmpty() ? null : joined;
    }
    
    @SuppressWarnings("unchecked")
    private Optional<Map<String, Object>> extractSection(Map<String, Object> payload, String key) {
        Object section = payload.get(key);
        if (section instanceof Map) {
            return Optional.of((Map<String, Object>) section);
        }
        return Optional.empty();
    }
}
