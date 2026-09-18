package com.healthcare.epcr.epcr.service.impl;

import com.healthcare.epcr.epcr.dto.CreatePatientCareRecordRequest;
import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import com.healthcare.epcr.epcr.enums.IncidentType;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.model.AuditEntry;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.model.IncidentTimeline;
import java.util.Map;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.epcr.service.IPatientCareRecordService;
import com.healthcare.epcr.epcr.service.PatientCareRecordCacheService;
import com.healthcare.epcr.common.dto.PageResponse;
import com.healthcare.epcr.common.exception.IdempotencyInProgressException;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.idempotency.model.IdempotencyRequest;
import com.healthcare.epcr.idempotency.repository.IdempotencyRequestRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.qa.rule.service.QARuleEngineService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.auditlog.model.AuditLog;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.patient.service.PatientSearchCacheService;
import com.healthcare.epcr.patienthistory.model.PatientEncounter;
import com.healthcare.epcr.patienthistory.service.PatientHistoryService;
import com.healthcare.epcr.patienthistory.repository.MedicationOrderRepository;
import com.healthcare.epcr.patienthistory.model.MedicationOrder;
import com.healthcare.epcr.followup.service.FollowUpTaskService;
import com.healthcare.epcr.hl7.service.Hl7OutboundSender;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.service.NotificationService;
import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.rulesengine.service.IfThenLogicService;
import com.healthcare.epcr.reports.service.PatientAnalyticsService;
import com.healthcare.epcr.config.SupabaseStorageService;
import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.service.OrganizationConfigCacheService;
import com.healthcare.epcr.qa.model.QAForm;
import com.healthcare.epcr.qa.model.QAReview;
import com.healthcare.epcr.qa.repository.QAFormRepository;
import com.healthcare.epcr.qa.repository.QAReviewRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import jakarta.annotation.PostConstruct;
import org.bson.Document;

import java.time.ZoneId;
import java.util.Set;
import java.util.HashSet;
import java.util.Date;
import java.time.Instant;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.time.temporal.ChronoUnit;
import lombok.extern.slf4j.Slf4j;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PatientCareRecordServiceImpl implements IPatientCareRecordService {
    private final PatientCareRecordRepository recordRepository;
    private final MongoTemplate mongoTemplate;
    private final UserRepository userRepository;
    private final AccessControlService accessControlService;
    private final QARuleEngineService qaRuleEngineService;
    private final PhiCryptoService phiCryptoService;
    private final AuditLogService auditLogService;
    private final PatientRepository patientRepository;
    private final OrganizationConfigCacheService organizationConfigCacheService;
    private final PasswordEncoder passwordEncoder;
    private final QAReviewRepository qaReviewRepository;
    private final QAFormRepository qaFormRepository;
    private final NotificationService notificationService;
    private final IfThenLogicService ifThenLogicService;
    private final PatientHistoryService patientHistoryService;
    private final PatientCareRecordCacheService patientCareRecordCacheService;
    private final PatientSearchCacheService patientSearchCacheService;
    private final IdempotencyRequestRepository idempotencyRequestRepository;
    private final FollowUpTaskService followUpTaskService;
    private final Hl7OutboundSender hl7OutboundSender;
    private final MedicationOrderRepository medicationOrderRepository;
    private final EmailService emailService;
    private final SupabaseStorageService supabaseStorageService;
    private final PatientAnalyticsService patientAnalyticsService;

    private void deleteOldPhotoFromStorage(String oldPhotoUrl) {
        if (oldPhotoUrl == null || oldPhotoUrl.isBlank()) return;
        try {
            if (oldPhotoUrl.contains("photos/") || oldPhotoUrl.contains("patient-history/")) {
                String key = oldPhotoUrl;
                int idx = key.indexOf("photos/");
                if (idx == -1) idx = key.indexOf("patient-history/");
                if (idx != -1) {
                    key = key.substring(idx);
                    int queryIdx = key.indexOf("?");
                    if (queryIdx != -1) key = key.substring(0, queryIdx);
                    supabaseStorageService.deleteFile(key);
                    log.info("Successfully deleted previous patient photo from Supabase Storage: key={}", key);
                }
            }
        } catch (Exception e) {
            log.warn("Could not delete previous photo from Supabase Storage: {}", e.getMessage());
        }
    }

    @Override
    public List<String> getIncidentTypes() {
        return IncidentType.codes();
    }

    @Override
    public PatientCareRecordDTO createRecord(CreatePatientCareRecordRequest request) {
        return createRecord(request, null);
    }

    @Override
    public PatientCareRecordDTO createRecord(CreatePatientCareRecordRequest request, String idempotencyKey) {
        User currentUser = getCurrentUser();
        String normalizedKey = normalizeIdempotencyKey(idempotencyKey);
        if (normalizedKey == null) {
            return createRecordForUser(request, currentUser, null);
        }

        IdempotencyRequest marker;
        try {
            marker = reserveIdempotencyRequest(currentUser, normalizedKey);
        } catch (CompletedIdempotencyRequestException ex) {
            return ex.getRecord();
        }
        try {
            return createRecordForUser(request, currentUser, marker);
        } catch (RuntimeException ex) {
            if (marker.getResourceId() == null) {
                idempotencyRequestRepository.deleteById(marker.getId());
            }
            throw ex;
        }
    }

    private PatientCareRecordDTO createRecordForUser(
            CreatePatientCareRecordRequest request,
            User currentUser,
            IdempotencyRequest idempotencyRequest) {
        PatientCareRecord record = new PatientCareRecord();
        String patientId = resolvePatientId(request);
        PatientCareRecord existingPatientRecord = findLatestRecordForPatient(patientId).orElse(null);
        String incidentNumber = generateUniqueIncidentNumber();
        String incidentType = validateIncidentType(request.getIncidentType());
        record.setPatientId(patientId);
        record.setPatientName(firstNonBlank(request.getPatientName(), valueFrom(existingPatientRecord, PatientCareRecord::getPatientName)));
        record.setPatientDateOfBirth(firstNonBlank(request.getPatientDateOfBirth(), valueFrom(existingPatientRecord, PatientCareRecord::getPatientDateOfBirth)));
        record.setPatientGender(request.getPatientGender() != null ? request.getPatientGender() : existingPatientRecord == null ? null : existingPatientRecord.getPatientGender());
        record.setPatientPhone(firstNonBlank(request.getPatientPhone(), valueFrom(existingPatientRecord, PatientCareRecord::getPatientPhone)));
        record.setPatientAddress(firstNonBlank(request.getPatientAddress(), valueFrom(existingPatientRecord, PatientCareRecord::getPatientAddress)));
        record.setPatientPhotoUrl(firstNonBlank(request.getPatientPhotoUrl(), valueFrom(existingPatientRecord, PatientCareRecord::getPatientPhotoUrl)));
        record.setIncidentDateTime(request.getIncidentDateTime());
        record.setIncidentLocation(request.getIncidentLocation());
        record.setIncidentDescription(request.getIncidentDescription());
        record.setIncidentType(incidentType);
        record.setParamedicsId(currentUser.getId());
        record.setOrganizationId(currentUser.getOrganizationId());
        record.setComplaints(request.getComplaints());
        record.setVitals(request.getVitals());
        record.setDiagnosis(request.getDiagnosis());
        record.setTreatmentProvided(request.getTreatmentProvided());
        record.setTreatmentPlan(request.getTreatmentPlan());
        record.setDietAdvice(request.getDietAdvice());
        record.setNotes(request.getNotes());
        record.setTransportDestination(request.getTransportDestination());
        record.setTransportMode(request.getTransportMode());
        record.setCareLevel(request.getCareLevel());
        record.setPatientPhotoUrl(firstNonBlank(request.getPatientPhotoUrl(), valueFrom(existingPatientRecord, PatientCareRecord::getPatientPhotoUrl)));
        record.setMedicationsAdministered(request.getMedicationsAdministered());
        record.setProceduresPerformed(request.getProceduresPerformed());
        record.setClinicalData(request.getClinicalData());
        record.setDynamicFormResponses(request.getDynamicFormResponses());
        record.setPatientSSNLast4(firstNonBlank(request.getPatientSSNLast4(), valueFrom(existingPatientRecord, PatientCareRecord::getPatientSSNLast4)));
        record.setHeight(request.getHeight() != null ? request.getHeight() : existingPatientRecord == null ? null : existingPatientRecord.getHeight());
        record.setWeight(request.getWeight() != null ? request.getWeight() : existingPatientRecord == null ? null : existingPatientRecord.getWeight());
        record.setAge(request.getAge() != null ? request.getAge() : existingPatientRecord == null ? null : existingPatientRecord.getAge());
        record.setEmail(firstNonBlank(request.getEmail(), valueFrom(existingPatientRecord, PatientCareRecord::getEmail)));
        record.setBloodGroup(firstNonBlank(request.getBloodGroup(), valueFrom(existingPatientRecord, PatientCareRecord::getBloodGroup)));
        record.setSpo2(request.getSpo2() != null ? request.getSpo2() : existingPatientRecord == null ? null : existingPatientRecord.getSpo2());
        record.setRespirationRate(request.getRespirationRate() != null ? request.getRespirationRate() : existingPatientRecord == null ? null : existingPatientRecord.getRespirationRate());
        record.setBloodSugar(request.getBloodSugar() != null ? request.getBloodSugar() : existingPatientRecord == null ? null : existingPatientRecord.getBloodSugar());
        record.setHeartRate(request.getHeartRate() != null ? request.getHeartRate() : existingPatientRecord == null ? null : existingPatientRecord.getHeartRate());
        record.setDiastolicBp(request.getDiastolicBp() != null ? request.getDiastolicBp() : existingPatientRecord == null ? null : existingPatientRecord.getDiastolicBp());
        record.setSystolicBp(request.getSystolicBp() != null ? request.getSystolicBp() : existingPatientRecord == null ? null : existingPatientRecord.getSystolicBp());
        record.setPulseRate(request.getPulseRate() != null ? request.getPulseRate() : existingPatientRecord == null ? null : existingPatientRecord.getPulseRate());
        record.setTemperature(request.getTemperature() != null ? request.getTemperature() : existingPatientRecord == null ? null : existingPatientRecord.getTemperature());
        record.setHemoglobin(request.getHemoglobin() != null ? request.getHemoglobin() : existingPatientRecord == null ? null : existingPatientRecord.getHemoglobin());
        record.setComorbidity(firstNonBlank(request.getComorbidity(), valueFrom(existingPatientRecord, PatientCareRecord::getComorbidity)));
        record.setAllergy(firstNonBlank(request.getAllergy(), valueFrom(existingPatientRecord, PatientCareRecord::getAllergy)));
        record.setDoctor(firstNonBlank(request.getDoctor(), valueFrom(existingPatientRecord, PatientCareRecord::getDoctor)));
        
        // Sync active CPOE medication prescriptions into the ePCR record
        String computedCurrentMedicines = firstNonBlank(request.getCurrentMedicines(), valueFrom(existingPatientRecord, PatientCareRecord::getCurrentMedicines));
        if (computedCurrentMedicines == null || computedCurrentMedicines.trim().isEmpty() || computedCurrentMedicines.equalsIgnoreCase("No active medications") || computedCurrentMedicines.equalsIgnoreCase("None")) {
            computedCurrentMedicines = "";
        }
        List<MedicationOrder> activeOrders = medicationOrderRepository.findByPatientIdAndOrderStatus(patientId, "ACTIVE");
        if (activeOrders != null && !activeOrders.isEmpty()) {
            String syncedMeds = activeOrders.stream()
                    .map(o -> o.getDrugGenericName() + " (" + o.getDosageStrength() + " " + o.getRoute() + " " + o.getFrequency() + ")")
                    .collect(Collectors.joining(", "));
            if (!computedCurrentMedicines.isEmpty()) {
                computedCurrentMedicines = computedCurrentMedicines + ", " + syncedMeds;
            } else {
                computedCurrentMedicines = syncedMeds;
            }
        }
        if (computedCurrentMedicines.isEmpty()) {
            computedCurrentMedicines = "No active medications";
        }
        record.setCurrentMedicines(computedCurrentMedicines);

        record.setMedicalHistory(request.getMedicalHistory() != null ? request.getMedicalHistory() : existingPatientRecord == null ? null : existingPatientRecord.getMedicalHistory());
        record.setIncidentNumber(incidentNumber);
        record.setSceneAssessment(request.getSceneAssessment());
        record.setCrew(request.getCrew());
        record.setTimeline(request.getTimeline());
        record.setStructuredComplaints(request.getStructuredComplaints());
        record.setStructuredVitals(request.getStructuredVitals());
        record.setIcd10Code(request.getIcd10Code());
        record.setPrimaryImpression(request.getPrimaryImpression());
        record.setSecondaryImpression(request.getSecondaryImpression());
        record.setStructuredMedications(request.getStructuredMedications());
        record.setStructuredProcedures(request.getStructuredProcedures());
        record.setTransport(request.getTransport());
        record.setConsent(request.getConsent());
        upsertPatientPortalAccount(
                patientId,
                currentUser.getOrganizationId(),
                record.getEmail(),
                record.getPatientPhone()
        );
        computeTimeline(record);
        record.setAuditTrail(new ArrayList<>());
        record.getAuditTrail().add(new AuditEntry(
                LocalDateTime.now(),
                currentUser.getId(),
                buildUserDisplayName(currentUser),
                "CREATED",
                null,
                null,
                null,
                resolveIpAddress(),
                "Record created"
        ));
        String tag = request.getClinicalTag();
        if (tag == null || tag.isBlank()) {
            tag = computeClinicalTag(
                    record.getIncidentType(),
                    record.getDiagnosis(),
                    record.getPrimaryImpression(),
                    record.getIncidentDescription(),
                    record.getComplaints()
            );
        }
        record.setClinicalTag(tag);

        encryptPhiFields(record);
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        record.setStatus(RecordStatus.DRAFT);
        record.setQaApproved(false);
        PatientCareRecord saved = recordRepository.save(record);
        completeIdempotencyRequest(idempotencyRequest, saved.getId());
        createHistoryEncounter(saved);
        PatientCareRecord decryptedSaved = copyWithDecryptedPhi(saved);
        patientHistoryService.syncVitalsFromEpcr(decryptedSaved);
        patientHistoryService.syncConditionsAndMedicationsFromEpcr(decryptedSaved);
        evictPatientSearchCache(saved.getOrganizationId());
        patientAnalyticsService.incrementCounters(saved.getOrganizationId());
        notifyQaReviewersOnCreate(saved, currentUser);
        sendCreationEmails(decryptedSaved, currentUser);
        return mapToDTO(saved);
    }

    private void sendCreationEmails(PatientCareRecord record, User paramedic) {
        if (record == null) return;

        // 1. Patient Email Notification
        String patientEmail = record.getEmail();
        if (patientEmail != null && !patientEmail.isBlank()) {
            try {
                String patientSubject = "Your Electronic Patient Care Record (ePCR) Health Summary & Portal Access";
                String portalLink = "https://ihp.ind.in/epcr";
                String patientName = record.getPatientName() != null ? record.getPatientName() : "Patient";
                String incidentDate = record.getIncidentDateTime() != null ? record.getIncidentDateTime().toString() : "N/A";
                String incidentNum = record.getIncidentNumber() != null ? record.getIncidentNumber() : "N/A";
                String complaintStr = record.getComplaints() != null && !record.getComplaints().isEmpty() ? String.join(", ", record.getComplaints()) : "N/A";

                String patientPhoto = record.getPatientPhotoUrl();
                String patientPhotoTag = (patientPhoto != null && !patientPhoto.isBlank())
                        ? "<div style=\"text-align: center; margin: 12px 0;\"><img src=\"" + patientPhoto + "\" style=\"max-width: 140px; max-height: 140px; border-radius: 50%; object-fit: cover; border: 3px solid #1A3C8F; box-shadow: 0 4px 6px rgba(0,0,0,0.1);\" alt=\"Patient Photo\" /></div>"
                        : "";

                String patientBody = "<div style=\"font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF;\">" +
                        "<div style=\"background: linear-gradient(135deg, #1A3C8F 0%, #0F1A3A 100%); padding: 20px; border-radius: 8px; text-align: center;\">" +
                        "<h1 style=\"color: #FFFFFF; margin: 0; font-size: 20px; letter-spacing: 0.5px;\">MedEPCR Health Portal Access</h1>" +
                        "<p style=\"color: #94A3B8; margin: 5px 0 0 0; font-size: 13px;\">Secure Patient Health Documentation</p>" +
                        "</div>" +
                        "<div style=\"padding: 20px 0 10px 0;\">" +
                        patientPhotoTag +
                        "<p style=\"font-size: 15px;\">Hello <strong>" + patientName + "</strong>,</p>" +
                        "<p style=\"font-size: 14px; color: #475569;\">An Electronic Patient Care Record (ePCR) was successfully documented for your recent care on <strong>" + incidentDate + "</strong>.</p>" +
                        "<div style=\"background-color: #F8FAFC; border-left: 4px solid #1A3C8F; padding: 12px 16px; margin: 16px 0; border-radius: 4px;\">" +
                        "<p style=\"margin: 4px 0; font-size: 13px;\"><strong>Incident Number:</strong> " + incidentNum + "</p>" +
                        "<p style=\"margin: 4px 0; font-size: 13px;\"><strong>Chief Reason:</strong> " + complaintStr + "</p>" +
                        "</div>" +
                        "<h3 style=\"color: #0F1A3A; font-size: 15px; margin-top: 20px;\">🔑 How to Access Your Patient Portal:</h3>" +
                        "<ol style=\"font-size: 13px; color: #334155; line-height: 1.6; padding-left: 20px;\">" +
                        "<li>Click the <strong>Access Patient Portal</strong> button below or visit <a href=\"" + portalLink + "\" style=\"color: #1A3C8F;\">https://ihp.ind.in/epcr</a></li>" +
                        "<li>Enter your registered Phone Number or Email address on the login screen.</li>" +
                        "<li>Enter the One-Time Password (OTP) sent to your mobile device / email.</li>" +
                        "<li>Explore your personalized dashboard to view <strong>AI Health Reports</strong>, <strong>Vitals History</strong>, <strong>Encounter Summaries</strong>, and <strong>Medication Safety</strong>.</li>" +
                        "</ol>" +
                        "<div style=\"text-align: center; margin: 28px 0;\">" +
                        "<a href=\"" + portalLink + "\" style=\"background-color: #1A3C8F; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(26, 60, 143, 0.3);\">Access Patient Portal</a>" +
                        "</div>" +
                        "</div>" +
                        "<hr style=\"border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;\" />" +
                        "<p style=\"font-size: 11px; color: #94A3B8; text-align: center;\">MedEPCR Automated Health Alert • Direct Link: <a href=\"https://ihp.ind.in/epcr\" style=\"color: #1A3C8F;\">https://ihp.ind.in/epcr</a></p>" +
                        "</div>";

                emailService.sendEmail(patientEmail, patientSubject, patientBody);
                log.info("Queued patient ePCR creation email to {}", patientEmail);
            } catch (Exception ex) {
                log.error("Failed to queue patient ePCR creation email for record {}", record.getIncidentNumber(), ex);
            }
        }

        // 2. Doctor Email Notification
        String doctorTarget = record.getDoctor();
        String doctorEmail = null;
        if (doctorTarget != null && !doctorTarget.isBlank()) {
            if (doctorTarget.contains("@")) {
                doctorEmail = doctorTarget;
            } else {
                User docUser = userRepository.findById(doctorTarget)
                        .orElseGet(() -> userRepository.findByEmail(doctorTarget).orElse(null));
                if (docUser != null && docUser.getEmail() != null && !docUser.getEmail().isBlank()) {
                    doctorEmail = docUser.getEmail();
                }
            }
        }
        if (doctorEmail == null && record.getMedicalHistory() != null) {
            String physContact = record.getMedicalHistory().getPrimaryPhysicianContact();
            if (physContact != null && physContact.contains("@")) {
                doctorEmail = physContact;
            }
        }
        if (doctorEmail == null && record.getOrganizationId() != null) {
            List<User> orgPhysicians = userRepository.findByOrganizationIdAndRole(record.getOrganizationId(), Role.PHYSICIAN);
            if (orgPhysicians != null) {
                for (User u : orgPhysicians) {
                    if (u.getEmail() != null && !u.getEmail().isBlank()) {
                        doctorEmail = u.getEmail();
                        break;
                    }
                }
            }
        }

        if (doctorEmail != null && !doctorEmail.isBlank()) {
            try {
                String docSubject = "Clinical Alert: New ePCR Documented - Incident #" + (record.getIncidentNumber() != null ? record.getIncidentNumber() : "");
                String paramedicName = paramedic != null ? (paramedic.getFirstName() + " " + paramedic.getLastName()).trim() : "Paramedic / EMS";
                String docIncidentNum = record.getIncidentNumber() != null ? record.getIncidentNumber() : "N/A";
                String docPatientName = record.getPatientName() != null ? record.getPatientName() : "N/A";
                String docIncidentDate = record.getIncidentDateTime() != null ? record.getIncidentDateTime().toString() : "N/A";
                String docImpression = record.getPrimaryImpression() != null ? record.getPrimaryImpression() : "N/A";
                String docDiagnosis = record.getDiagnosis() != null ? record.getDiagnosis() : "N/A";
                String docAge = record.getAge() != null ? record.getAge() + " yrs" : "N/A";
                String docGender = record.getPatientGender() != null ? record.getPatientGender().toString() : "N/A";
                String docPhoto = record.getPatientPhotoUrl();

                String photoTag = (docPhoto != null && !docPhoto.isBlank())
                        ? "<img src=\"" + docPhoto + "\" alt=\"Patient Photo\" style=\"width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid #1A3C8F; float: right; margin-left: 10px;\" />"
                        : "";

                String docBody = "<div style=\"font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF;\">" +
                        "<div style=\"background: linear-gradient(135deg, #0F1A3A 0%, #1A3C8F 100%); padding: 18px; border-radius: 8px;\">" +
                        "<h2 style=\"color: #FFFFFF; margin: 0; font-size: 18px;\">🚑 New ePCR Creation & Clinical Alert</h2>" +
                        "<p style=\"color: #CBD5E1; margin: 4px 0 0 0; font-size: 12px;\">Documented by " + paramedicName + "</p>" +
                        "</div>" +
                        "<div style=\"padding: 20px 0;\">" +
                        photoTag +
                        "<p style=\"font-size: 14px;\">Doctor,</p>" +
                        "<p style=\"font-size: 13px; color: #475569;\">A new Emergency Patient Care Record has been authored and transferred for clinical review.</p>" +
                        "<div style=\"background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;\">" +
                        "<h4 style=\"margin: 0 0 10px 0; color: #0F1A3A; font-size: 14px; text-transform: uppercase;\">📋 Patient Reference Card</h4>" +
                        "<table style=\"width: 100%; border-collapse: collapse; font-size: 13px;\">" +
                        "<tr><td style=\"padding: 4px 0; font-weight: bold; color: #64748B; width: 40%;\">Patient Name:</td><td style=\"padding: 4px 0; font-weight: bold; color: #0F1A3A;\">" + docPatientName + "</td></tr>" +
                        "<tr><td style=\"padding: 4px 0; font-weight: bold; color: #64748B;\">Age / Gender:</td><td style=\"padding: 4px 0;\">" + docAge + " / " + docGender + "</td></tr>" +
                        "<tr><td style=\"padding: 4px 0; font-weight: bold; color: #64748B;\">Incident #:</td><td style=\"padding: 4px 0; font-weight: bold;\">" + docIncidentNum + "</td></tr>" +
                        "<tr><td style=\"padding: 4px 0; font-weight: bold; color: #64748B;\">Date & Time:</td><td style=\"padding: 4px 0;\">" + docIncidentDate + "</td></tr>" +
                        "<tr><td style=\"padding: 4px 0; font-weight: bold; color: #64748B;\">Primary Impression:</td><td style=\"padding: 4px 0; color: #D97706; font-weight: bold;\">" + docImpression + "</td></tr>" +
                        "<tr><td style=\"padding: 4px 0; font-weight: bold; color: #64748B;\">Diagnosis:</td><td style=\"padding: 4px 0;\">" + docDiagnosis + "</td></tr>" +
                        "</table>" +
                        "</div>" +
                        "<p style=\"font-size: 13px; color: #475569;\">Please log into the MedEPCR System to review full vital trends, interventions, and sign off.</p>" +
                        "<div style=\"text-align: center; margin: 24px 0;\">" +
                        "<a href=\"https://ihp.ind.in/epcr\" style=\"background-color: #0F1A3A; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;\">Review Record in MedEPCR</a>" +
                        "</div>" +
                        "</div>" +
                        "<hr style=\"border: none; border-top: 1px solid #E2E8F0; margin: 16px 0;\" />" +
                        "<p style=\"font-size: 11px; color: #94A3B8; text-align: center;\">MedEPCR Automated Alert System</p>" +
                        "</div>";

                emailService.sendEmail(doctorEmail, docSubject, docBody);
                log.info("Queued doctor ePCR creation email to {}", doctorEmail);
            } catch (Exception ex) {
                log.error("Failed to queue doctor ePCR creation email for record {}", record.getIncidentNumber(), ex);
            }
        }
    }

    private IdempotencyRequest reserveIdempotencyRequest(User currentUser, String idempotencyKey) {
        String markerId = idempotencyMarkerId(currentUser.getId(), idempotencyKey);
        IdempotencyRequest marker = new IdempotencyRequest(
                markerId,
                currentUser.getId(),
                idempotencyKey,
                "CREATE_EPCR_RECORD",
                "PROCESSING",
                null,
                LocalDateTime.now(),
                LocalDateTime.now()
        );
        try {
            return idempotencyRequestRepository.insert(marker);
        } catch (DuplicateKeyException ex) {
            IdempotencyRequest existing = idempotencyRequestRepository.findById(markerId)
                    .orElseThrow(() -> new IdempotencyInProgressException("Idempotent request is already processing"));
            if ("COMPLETED".equals(existing.getStatus()) && existing.getResourceId() != null) {
                PatientCareRecord existingRecord = recordRepository.findById(existing.getResourceId())
                        .filter(this::canAccessRecord)
                        .orElseThrow(() -> new ResourceNotFoundException("Idempotent ePCR record not found: " + existing.getResourceId()));
                throw new CompletedIdempotencyRequestException(mapToDTO(existingRecord));
            }
            throw new IdempotencyInProgressException("Request with this Idempotency-Key is still processing");
        }
    }

    private void completeIdempotencyRequest(IdempotencyRequest marker, String resourceId) {
        if (marker == null) {
            return;
        }
        marker.setStatus("COMPLETED");
        marker.setResourceId(resourceId);
        marker.setUpdatedAt(LocalDateTime.now());
        idempotencyRequestRepository.save(marker);
    }

    private String normalizeIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return null;
        }
        String normalized = idempotencyKey.trim();
        if (normalized.length() > 200) {
            throw new IllegalArgumentException("Idempotency-Key must be 200 characters or fewer");
        }
        return normalized;
    }

    private String validateIncidentType(String incidentType) {
        if (incidentType == null || incidentType.isBlank()) {
            return null;
        }
        return IncidentType.from(incidentType)
                .map(IncidentType::getCode)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Invalid incidentType: " + incidentType + ". Valid incident types: "
                                + String.join(", ", IncidentType.codes())));
    }

    private String idempotencyMarkerId(String userId, String idempotencyKey) {
        return userId + ":CREATE_EPCR_RECORD:" + idempotencyKey;
    }

    private static class CompletedIdempotencyRequestException extends RuntimeException {
        private final PatientCareRecordDTO record;

        CompletedIdempotencyRequestException(PatientCareRecordDTO record) {
            this.record = record;
        }

        PatientCareRecordDTO getRecord() {
            return record;
        }
    }

    @Override
    public Optional<PatientCareRecordDTO> getRecordById(String id) {
        Optional<PatientCareRecordDTO> cached = patientCareRecordCacheService.getRecord(id);
        if (cached.isPresent()) {
            PatientCareRecordDTO cachedRecord = cached.get();
            return accessControlService.canAccessOrganization(cachedRecord.getOrganizationId())
                    ? cached
                    : Optional.empty();
        }

        Optional<PatientCareRecordDTO> record = recordRepository.findById(id)
                .filter(this::canAccessRecord)
                .map(this::mapToDTO);
        record.ifPresent(dto -> patientCareRecordCacheService.putRecord(id, dto));
        return record;
    }

    @Override
    public List<PatientCareRecordDTO> getRecordsByParamedic(String paramedicsId) {
        User currentUser = getCurrentUser();
        if (currentUser.getRole() != Role.ADMIN && !accessControlService.isSystemWideQaUser(currentUser)) {
            return mapRecordsToDTO(recordRepository.findByOrganizationId(currentUser.getOrganizationId()));
        }
        return mapRecordsToDTO(recordRepository.findByParamedicsId(paramedicsId)
                .stream().filter(this::canAccessRecord).collect(Collectors.toList()));
    }

    @Override
    public List<PatientCareRecordDTO> getRecordsByOrganization(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return mapRecordsToDTO(recordRepository.findByOrganizationId(organizationId));
    }

    @Override
    public List<PatientCareRecordDTO> getRecordsByStatus(RecordStatus status) {
        return mapRecordsToDTO(recordRepository.findByStatus(status)
                .stream().filter(this::canAccessRecord).collect(Collectors.toList()));
    }

    @Override
    public List<PatientCareRecordDTO> getPendingQAApproval() {
        return mapRecordsToDTO(recordRepository.findByQaApproved(false)
                .stream().filter(this::canAccessRecord).collect(Collectors.toList()));
    }

    @Override
    public PatientCareRecordDTO updateRecord(String id, CreatePatientCareRecordRequest request) {
        User currentUser = getCurrentUser();
        PatientCareRecord record = recordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Record not found with id: " + id));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());
        
        PatientCareRecordDTO oldDto = mapToDTO(record);
        
        if (request.getPatientName() != null) record.setPatientName(request.getPatientName());
        if (request.getPatientPhotoUrl() != null && !request.getPatientPhotoUrl().isBlank()) {
            String oldPhoto = record.getPatientPhotoUrl();
            if (oldPhoto != null && !oldPhoto.isBlank() && !oldPhoto.equals(request.getPatientPhotoUrl())) {
                deleteOldPhotoFromStorage(oldPhoto);
            }
            record.setPatientPhotoUrl(request.getPatientPhotoUrl());
            if (record.getPatientId() != null && !record.getPatientId().isBlank()) {
                List<PatientCareRecord> siblings = recordRepository.findByPatientId(record.getPatientId());
                for (PatientCareRecord sib : siblings) {
                    if (!sib.getId().equals(record.getId())) {
                        sib.setPatientPhotoUrl(request.getPatientPhotoUrl());
                        recordRepository.save(sib);
                    }
                }
            }
        }
        if (request.getIncidentDescription() != null) record.setIncidentDescription(request.getIncidentDescription());
        if (request.getPatientDateOfBirth() != null) record.setPatientDateOfBirth(request.getPatientDateOfBirth());
        if (request.getPatientPhone() != null) record.setPatientPhone(request.getPatientPhone());
        if (request.getPatientAddress() != null) record.setPatientAddress(request.getPatientAddress());
        if (request.getIncidentLocation() != null) record.setIncidentLocation(request.getIncidentLocation());
        if (request.getIncidentType() != null) record.setIncidentType(validateIncidentType(request.getIncidentType()));
        if (request.getPatientGender() != null) record.setPatientGender(request.getPatientGender());
        if (request.getIncidentDateTime() != null) record.setIncidentDateTime(request.getIncidentDateTime());
        if (request.getDiagnosis() != null) record.setDiagnosis(request.getDiagnosis());
        if (request.getTreatmentProvided() != null) record.setTreatmentProvided(request.getTreatmentProvided());
        if (request.getTreatmentPlan() != null) record.setTreatmentPlan(request.getTreatmentPlan());
        if (request.getDietAdvice() != null) record.setDietAdvice(request.getDietAdvice());
        if (request.getNotes() != null) record.setNotes(request.getNotes());
        if (request.getComplaints() != null) record.setComplaints(request.getComplaints());
        if (request.getVitals() != null) record.setVitals(request.getVitals());
        if (request.getTransportMode() != null) record.setTransportMode(request.getTransportMode());
        if (request.getCareLevel() != null) record.setCareLevel(request.getCareLevel());
        if (request.getTransportDestination() != null) record.setTransportDestination(request.getTransportDestination());
        if (request.getMedicationsAdministered() != null) record.setMedicationsAdministered(request.getMedicationsAdministered());
        if (request.getProceduresPerformed() != null) record.setProceduresPerformed(request.getProceduresPerformed());
        if (request.getClinicalData() != null) record.setClinicalData(request.getClinicalData());
        if (request.getDynamicFormResponses() != null) record.setDynamicFormResponses(request.getDynamicFormResponses());
        if (request.getPatientSSNLast4() != null) record.setPatientSSNLast4(request.getPatientSSNLast4());
        if (request.getHeight() != null) record.setHeight(request.getHeight());
        if (request.getWeight() != null) record.setWeight(request.getWeight());
        if (request.getAge() != null) record.setAge(request.getAge());
        if (request.getEmail() != null) record.setEmail(request.getEmail());
        if (request.getBloodGroup() != null) record.setBloodGroup(request.getBloodGroup());
        if (request.getSpo2() != null) record.setSpo2(request.getSpo2());
        if (request.getRespirationRate() != null) record.setRespirationRate(request.getRespirationRate());
        if (request.getBloodSugar() != null) record.setBloodSugar(request.getBloodSugar());
        if (request.getHeartRate() != null) record.setHeartRate(request.getHeartRate());
        if (request.getDiastolicBp() != null) record.setDiastolicBp(request.getDiastolicBp());
        if (request.getSystolicBp() != null) record.setSystolicBp(request.getSystolicBp());
        if (request.getPulseRate() != null) record.setPulseRate(request.getPulseRate());
        if (request.getTemperature() != null) record.setTemperature(request.getTemperature());
        if (request.getHemoglobin() != null) record.setHemoglobin(request.getHemoglobin());
        if (request.getComorbidity() != null) record.setComorbidity(request.getComorbidity());
        if (request.getAllergy() != null) record.setAllergy(request.getAllergy());
        if (request.getDoctor() != null) record.setDoctor(request.getDoctor());
        if (request.getCurrentMedicines() != null) record.setCurrentMedicines(request.getCurrentMedicines());
        if (request.getMedicalHistory() != null) record.setMedicalHistory(request.getMedicalHistory());
        if (request.getSceneAssessment() != null) record.setSceneAssessment(request.getSceneAssessment());
        if (request.getCrew() != null) record.setCrew(request.getCrew());
        if (request.getTimeline() != null) record.setTimeline(request.getTimeline());
        if (request.getStructuredComplaints() != null) record.setStructuredComplaints(request.getStructuredComplaints());
        if (request.getStructuredVitals() != null) record.setStructuredVitals(request.getStructuredVitals());
        if (request.getIcd10Code() != null) record.setIcd10Code(request.getIcd10Code());
        if (request.getPrimaryImpression() != null) record.setPrimaryImpression(request.getPrimaryImpression());
        if (request.getSecondaryImpression() != null) record.setSecondaryImpression(request.getSecondaryImpression());
        if (request.getStructuredMedications() != null) record.setStructuredMedications(request.getStructuredMedications());
        if (request.getStructuredProcedures() != null) record.setStructuredProcedures(request.getStructuredProcedures());
        if (request.getTransport() != null) record.setTransport(request.getTransport());
        if (request.getConsent() != null) record.setConsent(request.getConsent());
        if ((request.getEmail() != null && !request.getEmail().isBlank())
                || (request.getPatientPhone() != null && !request.getPatientPhone().isBlank())) {
            upsertPatientPortalAccount(
                    record.getPatientId(),
                    record.getOrganizationId(),
                    request.getEmail(),
                    request.getPatientPhone()
            );
        }
        computeTimeline(record);
        if (request.getClinicalTag() != null) {
            record.setClinicalTag(request.getClinicalTag().isBlank() ? null : request.getClinicalTag());
        } else {
            String tag = computeClinicalTag(
                    record.getIncidentType(),
                    record.getDiagnosis(),
                    record.getPrimaryImpression(),
                    record.getIncidentDescription(),
                    record.getComplaints()
            );
            record.setClinicalTag(tag);
        }

        encryptPhiFields(record);
        record.setUpdatedAt(LocalDateTime.now());
        
        PatientCareRecord savedRecord = recordRepository.save(record);
        PatientCareRecordDTO newDto = mapToDTO(savedRecord);
        patientCareRecordCacheService.evictRecord(id);
        
        List<AuditLog.FieldChange> changes = diffObjects(oldDto, newDto);
        if (!changes.isEmpty()) {
            auditLogService.logActionWithChanges(
                    currentUser.getId(), buildUserDisplayName(currentUser),
                    "UPDATE_RECORD", "PATIENT_CARE_RECORD", record.getId(),
                    changes, "Record updated", "SUCCESS", resolveIpAddress()
            );
            
            if (record.getAuditTrail() == null) record.setAuditTrail(new ArrayList<>());
            record.getAuditTrail().add(new AuditEntry(
                    LocalDateTime.now(), currentUser.getId(), buildUserDisplayName(currentUser),
                    "UPDATED", "MULTIPLE", null, null, resolveIpAddress(), "Record updated with " + changes.size() + " fields"
            ));
            savedRecord = recordRepository.save(record);
        }
        createHistoryEncounter(savedRecord);
        PatientCareRecord decryptedSavedRecord = copyWithDecryptedPhi(savedRecord);
        patientHistoryService.syncVitalsFromEpcr(decryptedSavedRecord);
        patientHistoryService.syncConditionsAndMedicationsFromEpcr(decryptedSavedRecord);
        evictPatientSearchCache(savedRecord.getOrganizationId());
        followUpTaskService.scheduleIfCritical(savedRecord);
        return newDto;
    }

    @Override
    public PatientCareRecordDTO submitRecord(String id) {
        User currentUser = getCurrentUser();
        PatientCareRecord record = recordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Record not found with id: " + id));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());
        record.setStatus(RecordStatus.SUBMITTED);
        record.setSubmittedAt(LocalDateTime.now());
        record.setSubmittedBy(currentUser.getId());
        if (record.getDynamicFormResponses() == null) record.setDynamicFormResponses(new HashMap<>());
        PatientCareRecord decryptedForQa = copyWithDecryptedPhi(record);
        decryptedForQa.getDynamicFormResponses().put(
                "qaAutoFlags", qaRuleEngineService.evaluate(decryptedForQa.getOrganizationId(), decryptedForQa));
        record.setDynamicFormResponses(decryptedForQa.getDynamicFormResponses());
        if (record.getAuditTrail() == null) record.setAuditTrail(new ArrayList<>());
        record.getAuditTrail().add(new AuditEntry(
                LocalDateTime.now(),
                currentUser.getId(),
                buildUserDisplayName(currentUser),
                "SUBMITTED",
                null,
                null,
                null,
                resolveIpAddress(),
                "Record submitted"
        ));
        record.setUpdatedAt(LocalDateTime.now());
        PatientCareRecord saved = recordRepository.save(record);
        patientCareRecordCacheService.evictRecord(id);
        ensurePendingQaReviewExists(saved);
        createHistoryEncounter(saved);
        PatientCareRecord decryptedSaved = copyWithDecryptedPhi(saved);
        patientHistoryService.syncVitalsFromEpcr(decryptedSaved);
        patientHistoryService.syncConditionsAndMedicationsFromEpcr(decryptedSaved);
        ifThenLogicService.runForRecord(saved, false);
        followUpTaskService.scheduleIfCritical(saved);

        evictPatientSearchCache(saved.getOrganizationId());
        notifyQaReviewersOnSubmit(saved, currentUser);
        PatientCareRecordDTO dto = mapToDTO(saved);
        // Automatically dispatch all standard HL7 integration messages to the destination hospital
        hl7OutboundSender.sendPatientAdmitMessage(dto);
        hl7OutboundSender.sendObservationResultMessage(dto);
        hl7OutboundSender.sendOrderMessage(dto);
        return dto;
    }

    @Override
    public void deleteRecord(String id) {
        PatientCareRecord record = recordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Record not found with id: " + id));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());
        recordRepository.deleteById(id);
        patientCareRecordCacheService.evictRecord(id);
        evictPatientSearchCache(record.getOrganizationId());
        patientAnalyticsService.clearCache(record.getOrganizationId());
    }

    @Override
    public List<PatientCareRecordDTO> getAllRecords() {
        User currentUser = getCurrentUser();
        // Scope at DB level for non-admin roles (including PARAMEDIC)
        if (currentUser.getRole() != Role.ADMIN && !accessControlService.isSystemWideQaUser(currentUser)) {
            return mapRecordsToDTO(recordRepository.findByOrganizationId(currentUser.getOrganizationId()));
        }
        return mapRecordsToDTO(recordRepository.findAll()
                .stream().filter(this::canAccessRecord).collect(Collectors.toList()));
    }

    @Override
    public PageResponse<PatientCareRecordDTO> getAllRecordsPaginated(
            int page, int size, String paramedicId,
            RecordStatus status, String incidentType, String search,
            LocalDateTime startDate, LocalDateTime endDate) {
        // Limit sorting to updatedAt and use NULLS_LAST for consistent ordering
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("updatedAt").with(Sort.NullHandling.NULLS_LAST)));
        User currentUser = getCurrentUser();
        boolean isAdmin = currentUser.getRole() == Role.ADMIN
                || accessControlService.isSystemWideQaUser(currentUser);

        Query query = new Query();

        if (!isAdmin) {
            if (currentUser.getRole() == Role.PARAMEDIC) {
                Criteria paramedicCriteria = new Criteria().orOperator(
                        Criteria.where("paramedicsId").is(currentUser.getId()),
                        Criteria.where("submittedBy").is(currentUser.getEmail()),
                        Criteria.where("paramedicsName").regex(currentUser.getFirstName() != null ? currentUser.getFirstName() : "---", "i")
                );
                if (currentUser.getOrganizationId() != null && !currentUser.getOrganizationId().isBlank()) {
                    query.addCriteria(new Criteria().andOperator(
                            Criteria.where("organizationId").is(currentUser.getOrganizationId()),
                            paramedicCriteria
                    ));
                } else {
                    query.addCriteria(paramedicCriteria);
                }
            } else if (currentUser.getOrganizationId() != null && !currentUser.getOrganizationId().isBlank()) {
                query.addCriteria(Criteria.where("organizationId").is(currentUser.getOrganizationId()));
            }
        }

        if (isAdmin && paramedicId != null && !paramedicId.isBlank()) {
            query.addCriteria(Criteria.where("paramedicsId").is(paramedicId));
        }

        if (status != null) {
            query.addCriteria(Criteria.where("status").is(status));
        }

        if (incidentType != null && !incidentType.isBlank()) {
            query.addCriteria(Criteria.where("incidentType").regex(incidentType, "i"));
        }

        if (search != null && !search.isBlank()) {
            Criteria searchCriteria = new Criteria().orOperator(
                    Criteria.where("patientName").regex(search, "i"),
                    Criteria.where("incidentLocation").regex(search, "i"),
                    Criteria.where("incidentType").regex(search, "i")
            );
            query.addCriteria(searchCriteria);
        }

        if (startDate != null && endDate != null) {
            query.addCriteria(Criteria.where("incidentDateTime").gte(startDate).lte(endDate));
        } else if (startDate != null) {
            query.addCriteria(Criteria.where("incidentDateTime").gte(startDate));
        } else if (endDate != null) {
            query.addCriteria(Criteria.where("incidentDateTime").lte(endDate));
        }

        // Only compute an exact total on the first page to avoid expensive count(*) on every page load
        Long total = null;
        if (page == 0) {
            total = mongoTemplate.count(query, PatientCareRecord.class);
        }

        // Project only the fields required for a list view to avoid loading full entities
        query.fields()
                .include("_id")
                .include("patientId")
                .include("patientName")
                .include("incidentDateTime")
                .include("incidentLocation")
                .include("incidentType")
                .include("paramedicsId")
                .include("organizationId")
                .include("status")
                .include("updatedAt")
                .include("createdAt")
                .include("incidentNumber")
                .include("submittedBy")
                .include("qaApproved")
                .include("qaApprovedBy")
                .include("clinicalTag")
                .include("patientPhotoUrl");

        if (page == 0) {
            query.with(pageable);
            List<Document> docs = mongoTemplate.find(query, Document.class, "patient_care_records");
            List<PatientCareRecordDTO> records = mapProjectionDocumentsToDTO(docs);
            int totalPages = (int) Math.ceil((double) total / size);
            boolean isLast = (page + 1) * size >= total;
            return new PageResponse<>(records, page, size, total, totalPages, isLast);
        } else {
            // Fetch size+1 to detect if this is the last page without running count()
            query.limit(size + 1);
            query.with(pageable);
            List<Document> docs = mongoTemplate.find(query, Document.class, "patient_care_records");
            boolean isLast = docs.size() <= size;
            if (docs.size() > size) docs = docs.subList(0, size);
            List<PatientCareRecordDTO> records = mapProjectionDocumentsToDTO(docs);
            long totalElements = -1L; // unknown to avoid expensive count
            int totalPages = -1;
            return new PageResponse<>(records, page, size, totalElements, totalPages, isLast);
        }
    }

    // ── FHIR helper method implementations ──────────────────────────────────

    @Override
    public List<PatientCareRecordDTO> getRecordsByPatientId(String patientId) {
        return mapRecordsToDTO(recordRepository.findByPatientId(patientId));
    }

    @Override
    public Optional<PatientCareRecordDTO> getLatestRecordByPatientId(String patientId) {
        return findLatestRecordForPatient(patientId).map(this::mapToDTO);
    }

    @Override
    public List<PatientCareRecordDTO> searchRecordsByDemographics(String name, String phone) {
        String trimmedName = name == null ? "" : name.trim().toLowerCase();
        String trimmedPhone = phone == null ? "" : phone.trim().toLowerCase();
        String digitsOnly = trimmedPhone.replaceAll("\\D", "");

        List<PatientCareRecord> allRecords = recordRepository.findAll();
        List<PatientCareRecord> matchingRecords = allRecords.stream()
                .filter(record -> {
                    // Check name match if provided
                    if (!trimmedName.isEmpty()) {
                        String decryptedName = phiCryptoService.decrypt(record.getPatientName());
                        if (decryptedName == null || !decryptedName.toLowerCase().contains(trimmedName)) {
                            return false;
                        }
                    }
                    // Check phone match if provided
                    if (!trimmedPhone.isEmpty()) {
                        String decryptedPhone = phiCryptoService.decrypt(record.getPatientPhone());
                        if (decryptedPhone == null) {
                            return false;
                        }
                        String normalizedPhone = decryptedPhone.replaceAll("\\D", "");
                        if (!normalizedPhone.contains(digitsOnly) && !decryptedPhone.contains(trimmedPhone)) {
                            return false;
                        }
                    }
                    return true;
                })
                .limit(10)
                .toList();

        return mapRecordsToDTO(matchingRecords);
    }
    // ────────────────────────────────────────────────────────────────────────

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new IllegalArgumentException("Authenticated user not found");
        }

        Object details = auth.getDetails();
        if (details instanceof CachedAuthSession session
                && session.getUserId() != null
                && !session.getUserId().isBlank()) {
            User userById = userRepository.findById(session.getUserId()).orElse(null);
            String authName = auth.getName();
            boolean emailMatches = authName == null
                    || authName.isBlank()
                    || (userById.getEmail() != null && userById.getEmail().equalsIgnoreCase(authName));
            if (userById != null && emailMatches) {
                return userById;
            }
        }

        if (auth.getName() == null || auth.getName().isBlank()) {
            throw new IllegalArgumentException("Authenticated user not found");
        }

        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + auth.getName()));
    }

    private boolean canAccessRecord(PatientCareRecord record) {
        if (record == null || !accessControlService.canAccessOrganization(record.getOrganizationId())) return false;
        User currentUser = getCurrentUser();
        return true;
    }

    private void encryptPhiFields(PatientCareRecord record) {
        record.setPatientName(phiCryptoService.encrypt(record.getPatientName()));
        record.setPatientDateOfBirth(phiCryptoService.encrypt(record.getPatientDateOfBirth()));
        record.setPatientPhone(phiCryptoService.encrypt(record.getPatientPhone()));
        record.setPatientAddress(phiCryptoService.encrypt(record.getPatientAddress()));
        record.setIncidentLocation(phiCryptoService.encrypt(record.getIncidentLocation()));
        record.setIncidentDescription(phiCryptoService.encrypt(record.getIncidentDescription()));
        record.setComplaints(phiCryptoService.encryptList(record.getComplaints()));
        record.setVitals(phiCryptoService.encryptList(record.getVitals()));
        record.setDiagnosis(phiCryptoService.encrypt(record.getDiagnosis()));
        record.setTreatmentProvided(phiCryptoService.encrypt(record.getTreatmentProvided()));
        record.setTreatmentPlan(phiCryptoService.encrypt(record.getTreatmentPlan()));
        record.setDietAdvice(phiCryptoService.encryptList(record.getDietAdvice()));
        record.setNotes(phiCryptoService.encryptList(record.getNotes()));
        record.setTransportDestination(phiCryptoService.encrypt(record.getTransportDestination()));
        record.setMedicationsAdministered(phiCryptoService.encryptList(record.getMedicationsAdministered()));
        record.setProceduresPerformed(phiCryptoService.encryptList(record.getProceduresPerformed()));
        record.setPatientSSNLast4(phiCryptoService.encrypt(record.getPatientSSNLast4()));
        record.setEmail(phiCryptoService.encrypt(record.getEmail()));
        record.setBloodGroup(phiCryptoService.encrypt(record.getBloodGroup()));
        record.setComorbidity(phiCryptoService.encrypt(record.getComorbidity()));
        record.setAllergy(phiCryptoService.encrypt(record.getAllergy()));
        record.setDoctor(phiCryptoService.encrypt(record.getDoctor()));
        record.setCurrentMedicines(phiCryptoService.encrypt(record.getCurrentMedicines()));
    }

    private PatientCareRecord copyWithDecryptedPhi(PatientCareRecord record) {
        if (record == null) return null;
        PatientCareRecord copy = new PatientCareRecord();
        copy.setId(record.getId());
        copy.setPatientId(record.getPatientId());
        copy.setPatientName(phiCryptoService.decrypt(record.getPatientName()));
        copy.setPatientDateOfBirth(phiCryptoService.decrypt(record.getPatientDateOfBirth()));
        copy.setPatientGender(record.getPatientGender());
        copy.setPatientPhone(phiCryptoService.decrypt(record.getPatientPhone()));
        copy.setPatientAddress(phiCryptoService.decrypt(record.getPatientAddress()));
        copy.setIncidentDateTime(record.getIncidentDateTime());
        copy.setIncidentLocation(phiCryptoService.decrypt(record.getIncidentLocation()));
        copy.setIncidentDescription(phiCryptoService.decrypt(record.getIncidentDescription()));
        copy.setIncidentType(record.getIncidentType());
        copy.setParamedicsId(record.getParamedicsId());
        copy.setOrganizationId(record.getOrganizationId());
        copy.setComplaints(phiCryptoService.decryptList(record.getComplaints()));
        copy.setVitals(phiCryptoService.decryptList(record.getVitals()));
        copy.setDiagnosis(phiCryptoService.decrypt(record.getDiagnosis()));
        copy.setTreatmentProvided(phiCryptoService.decrypt(record.getTreatmentProvided()));
        copy.setTreatmentPlan(phiCryptoService.decrypt(record.getTreatmentPlan()));
        copy.setDietAdvice(phiCryptoService.decryptList(record.getDietAdvice()));
        copy.setNotes(phiCryptoService.decryptList(record.getNotes()));
        copy.setTransportDestination(phiCryptoService.decrypt(record.getTransportDestination()));
        copy.setTransportMode(record.getTransportMode());
        copy.setCareLevel(record.getCareLevel());
        copy.setMedicationsAdministered(phiCryptoService.decryptList(record.getMedicationsAdministered()));
        copy.setProceduresPerformed(phiCryptoService.decryptList(record.getProceduresPerformed()));
        copy.setClinicalData(record.getClinicalData());
        copy.setStatus(record.getStatus());
        copy.setCreatedAt(record.getCreatedAt());
        copy.setUpdatedAt(record.getUpdatedAt());
        copy.setSubmittedAt(record.getSubmittedAt());
        copy.setSubmittedBy(record.getSubmittedBy());
        copy.setQaApproved(record.getQaApproved());
        copy.setQaApprovedAt(record.getQaApprovedAt());
        copy.setQaApprovedBy(record.getQaApprovedBy());
        copy.setAttachmentIds(record.getAttachmentIds());
        copy.setFeedback(record.getFeedback());
        copy.setDynamicFormResponses(record.getDynamicFormResponses());
        copy.setPatientSSNLast4(phiCryptoService.decrypt(record.getPatientSSNLast4()));
        copy.setHeight(record.getHeight());
        copy.setWeight(record.getWeight());
        copy.setAge(record.getAge());
        copy.setEmail(phiCryptoService.decrypt(record.getEmail()));
        copy.setBloodGroup(phiCryptoService.decrypt(record.getBloodGroup()));
        copy.setSpo2(record.getSpo2());
        copy.setRespirationRate(record.getRespirationRate());
        copy.setBloodSugar(record.getBloodSugar());
        copy.setHeartRate(record.getHeartRate());
        copy.setDiastolicBp(record.getDiastolicBp());
        copy.setSystolicBp(record.getSystolicBp());
        copy.setPulseRate(record.getPulseRate());
        copy.setTemperature(record.getTemperature());
        copy.setHemoglobin(record.getHemoglobin());
        copy.setComorbidity(phiCryptoService.decrypt(record.getComorbidity()));
        copy.setAllergy(phiCryptoService.decrypt(record.getAllergy()));
        copy.setDoctor(phiCryptoService.decrypt(record.getDoctor()));
        copy.setCurrentMedicines(phiCryptoService.decrypt(record.getCurrentMedicines()));
        copy.setMedicalHistory(record.getMedicalHistory());
        copy.setIncidentNumber(record.getIncidentNumber());
        copy.setSceneAssessment(record.getSceneAssessment());
        copy.setCrew(record.getCrew());
        copy.setTimeline(record.getTimeline());
        copy.setStructuredComplaints(record.getStructuredComplaints());
        copy.setStructuredVitals(record.getStructuredVitals());
        copy.setIcd10Code(record.getIcd10Code());
        copy.setPrimaryImpression(record.getPrimaryImpression());
        copy.setSecondaryImpression(record.getSecondaryImpression());
        copy.setStructuredMedications(record.getStructuredMedications());
        copy.setStructuredProcedures(record.getStructuredProcedures());
        copy.setTransport(record.getTransport());
        copy.setConsent(record.getConsent());
        copy.setAuditTrail(record.getAuditTrail());
        copy.setClinicalTag(record.getClinicalTag());
        copy.setPatientPhotoUrl(record.getPatientPhotoUrl());
        return copy;
    }

    private PatientCareRecordDTO mapToDTO(PatientCareRecord record) {
        return mapToDTO(record, new HashMap<>(), new HashMap<>());
    }

    private List<PatientCareRecordDTO> mapRecordsToDTO(List<PatientCareRecord> records) {
        Map<String, String> userNameCache = new HashMap<>();
        Map<String, String> organizationNameCache = new HashMap<>();
        return records == null ? List.of() : records.stream()
                .map(record -> mapToDTO(record, userNameCache, organizationNameCache))
                .collect(Collectors.toList());
    }

    /**
     * Map lightweight projection Documents returned from Mongo to DTOs.
     * This avoids fetching full entities and reduces N+1 by prefetching users in a single query.
     */
    private List<PatientCareRecordDTO> mapProjectionDocumentsToDTO(List<Document> docs) {
        if (docs == null) return List.of();

        // Collect user ids to fetch names in batch (fixes N+1 problem)
        Set<String> userIds = new HashSet<>();
        for (Document d : docs) {
            String pid = d.getString("paramedicsId");
            if (pid != null && !pid.isBlank()) userIds.add(pid);
            String submittedBy = d.getString("submittedBy");
            if (submittedBy != null && !submittedBy.isBlank()) userIds.add(submittedBy);
            String qaBy = d.getString("qaApprovedBy");
            if (qaBy != null && !qaBy.isBlank()) userIds.add(qaBy);
        }

        Map<String, User> usersById = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        Map<String, String> userNameCache = new HashMap<>();
        usersById.forEach((id, user) -> userNameCache.put(id, buildUserDisplayName(user)));

        Map<String, String> organizationNameCache = new HashMap<>();

        List<PatientCareRecordDTO> result = new ArrayList<>();
        for (Document d : docs) {
            PatientCareRecordDTO dto = new PatientCareRecordDTO();
            Object idObj = d.get("_id");
            dto.setId(idObj == null ? null : idObj.toString());
            dto.setPatientId(d.getString("patientId"));

            // Decrypt only the fields needed for list view
            dto.setPatientName(phiCryptoService.decrypt(d.getString("patientName")));
            dto.setIncidentDateTime(toLocalDateTime(d.get("incidentDateTime")));
            dto.setIncidentLocation(phiCryptoService.decrypt(d.getString("incidentLocation")));
            dto.setIncidentType(d.getString("incidentType"));

            String paramedicsId = d.getString("paramedicsId");
            dto.setParamedicsId(paramedicsId);
            dto.setParamedicsName(paramedicsId == null ? null : userNameCache.get(paramedicsId));

            String orgId = d.getString("organizationId");
            dto.setOrganizationId(orgId);
            dto.setOrganizationName(resolveOrganizationName(orgId, organizationNameCache));

            String rawStatus = d.getString("status");
            Boolean qaApproved = d.getBoolean("qaApproved");
            dto.setStatus(toCanonicalStatus(rawStatus, qaApproved));

            dto.setCreatedAt(toLocalDateTime(d.get("createdAt")));
            dto.setUpdatedAt(toLocalDateTime(d.get("updatedAt")));
            dto.setIncidentNumber(d.getString("incidentNumber"));

            String submittedBy = d.getString("submittedBy");
            dto.setSubmittedBy(submittedBy);
            dto.setSubmittedByName(submittedBy == null ? null : userNameCache.get(submittedBy));

            String qaBy = d.getString("qaApprovedBy");
            dto.setQaApprovedBy(qaBy);
            dto.setQaApprovedByName(qaBy == null ? null : userNameCache.get(qaBy));

            dto.setQaApproved(d.getBoolean("qaApproved"));
            dto.setClinicalTag(d.getString("clinicalTag"));
            dto.setPatientPhotoUrl(d.getString("patientPhotoUrl"));

            result.add(dto);
        }

        // Apply access control filter at Java level as a safety net
        return result.stream().filter(dto -> accessControlService.canAccessOrganization(dto.getOrganizationId())).collect(Collectors.toList());
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDateTime ldt) return ldt;
        if (value instanceof Date d) return LocalDateTime.ofInstant(Instant.ofEpochMilli(d.getTime()), ZoneId.systemDefault());
        try {
            // Fallback: if the driver returned a string, try parse
            return LocalDateTime.parse(value.toString());
        } catch (Exception ex) {
            return null;
        }
    }

    private String toCanonicalStatus(String rawStatus, Boolean qaApproved) {
        if (rawStatus == null) return null;
        String raw = rawStatus.toUpperCase(Locale.ROOT);
        if ("SUBMITTED".equals(raw) && Boolean.FALSE.equals(qaApproved)) return "QA_PENDING";
        if (("SUBMITTED".equals(raw) || "COMPLETED".equals(raw)) && Boolean.TRUE.equals(qaApproved)) return "QA_APPROVED";
        return raw;
    }

    private PatientCareRecordDTO mapToDTO(
            PatientCareRecord record,
            Map<String, String> userNameCache,
            Map<String, String> organizationNameCache) {
        PatientCareRecord d = copyWithDecryptedPhi(record);
        PatientCareRecordDTO dto = new PatientCareRecordDTO();
        dto.setId(d.getId());
        dto.setPatientId(d.getPatientId());
        dto.setPatientName(d.getPatientName());
        dto.setPatientDateOfBirth(d.getPatientDateOfBirth());
        dto.setPatientGender(d.getPatientGender());
        dto.setPatientPhone(d.getPatientPhone());
        dto.setPatientAddress(d.getPatientAddress());
        dto.setPatientSSNLast4(d.getPatientSSNLast4());
        dto.setIncidentDateTime(d.getIncidentDateTime());
        dto.setIncidentLocation(d.getIncidentLocation());
        dto.setIncidentDescription(d.getIncidentDescription());
        dto.setIncidentType(d.getIncidentType());
        dto.setParamedicsId(d.getParamedicsId());
        dto.setParamedicsName(resolveUserDisplayName(d.getParamedicsId(), userNameCache));
        dto.setOrganizationId(d.getOrganizationId());
        dto.setOrganizationName(resolveOrganizationName(d.getOrganizationId(), organizationNameCache));
        dto.setComplaints(d.getComplaints());
        dto.setVitals(d.getVitals());
        dto.setDiagnosis(d.getDiagnosis());
        dto.setTreatmentProvided(d.getTreatmentProvided());
        dto.setTreatmentPlan(d.getTreatmentPlan());
        dto.setDietAdvice(d.getDietAdvice());
        dto.setNotes(d.getNotes());
        dto.setTransportDestination(d.getTransportDestination());
        dto.setTransportMode(d.getTransportMode());
        dto.setCareLevel(d.getCareLevel());
        dto.setMedicationsAdministered(d.getMedicationsAdministered());
        dto.setProceduresPerformed(d.getProceduresPerformed());
        dto.setClinicalData(d.getClinicalData());
        dto.setStatus(toCanonicalStatus(d));
        dto.setCreatedAt(d.getCreatedAt());
        dto.setUpdatedAt(d.getUpdatedAt());
        dto.setSubmittedAt(d.getSubmittedAt());
        dto.setSubmittedBy(d.getSubmittedBy());
        dto.setSubmittedByName(resolveUserDisplayName(d.getSubmittedBy(), userNameCache));
        dto.setQaApproved(d.getQaApproved());
        dto.setQaApprovedAt(d.getQaApprovedAt());
        dto.setQaApprovedBy(d.getQaApprovedBy());
        dto.setQaApprovedByName(resolveUserDisplayName(d.getQaApprovedBy(), userNameCache));
        dto.setAttachmentIds(d.getAttachmentIds());
        dto.setFeedback(d.getFeedback());
        dto.setDynamicFormResponses(d.getDynamicFormResponses());
        dto.setMedicalHistory(d.getMedicalHistory());
        dto.setHeight(d.getHeight());
        dto.setWeight(d.getWeight());
        dto.setAge(d.getAge());
        dto.setEmail(d.getEmail());
        dto.setBloodGroup(d.getBloodGroup());
        dto.setSpo2(d.getSpo2());
        dto.setRespirationRate(d.getRespirationRate());
        dto.setBloodSugar(d.getBloodSugar());
        dto.setHeartRate(d.getHeartRate());
        dto.setDiastolicBp(d.getDiastolicBp());
        dto.setSystolicBp(d.getSystolicBp());
        dto.setPulseRate(d.getPulseRate());
        dto.setTemperature(d.getTemperature());
        dto.setHemoglobin(d.getHemoglobin());
        dto.setComorbidity(d.getComorbidity());
        dto.setAllergy(d.getAllergy());
        dto.setDoctor(d.getDoctor());
        dto.setCurrentMedicines(d.getCurrentMedicines());
        dto.setIncidentNumber(d.getIncidentNumber());
        dto.setSceneAssessment(d.getSceneAssessment());
        dto.setCrew(d.getCrew());
        dto.setTimeline(d.getTimeline());
        dto.setStructuredComplaints(d.getStructuredComplaints());
        dto.setStructuredVitals(d.getStructuredVitals());
        dto.setIcd10Code(d.getIcd10Code());
        dto.setPrimaryImpression(d.getPrimaryImpression());
        dto.setSecondaryImpression(d.getSecondaryImpression());
        dto.setStructuredMedications(d.getStructuredMedications());
        dto.setStructuredProcedures(d.getStructuredProcedures());
        dto.setTransport(d.getTransport());
        dto.setConsent(d.getConsent());
        dto.setAuditTrail(d.getAuditTrail());
        dto.setClinicalTag(d.getClinicalTag());
        return dto;
    }

    private String toCanonicalStatus(PatientCareRecord record) {
        if (record == null || record.getStatus() == null) return null;
        String raw = record.getStatus().name().toUpperCase(Locale.ROOT);
        if ("SUBMITTED".equals(raw) && Boolean.FALSE.equals(record.getQaApproved())) return "QA_PENDING";
        if (("SUBMITTED".equals(raw) || "COMPLETED".equals(raw)) && Boolean.TRUE.equals(record.getQaApproved()))
            return "QA_APPROVED";
        return raw;
    }

    private String buildUserDisplayName(User user) {
        if (user == null) return null;
        String first = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String last = user.getLastName() == null ? "" : user.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        return user.getEmail();
    }

    private String resolveUserDisplayName(String userId) {
        if (userId == null || userId.isBlank()) return null;
        return userRepository.findById(userId)
                .map(this::buildUserDisplayName)
                .filter(name -> name != null && !name.isBlank())
                .orElse(null);
    }

    private String resolveUserDisplayName(String userId, Map<String, String> cache) {
        if (userId == null || userId.isBlank()) return null;
        if (cache == null) return resolveUserDisplayName(userId);
        return cache.computeIfAbsent(userId, this::resolveUserDisplayName);
    }

    private String resolveOrganizationName(String organizationId) {
        if (organizationId == null || organizationId.isBlank()) return null;
        OrganizationDTO organization = organizationConfigCacheService.getOrganization(organizationId);
        return organization == null || organization.getName() == null || organization.getName().isBlank()
                ? null
                : organization.getName();
    }

    private String resolveOrganizationName(String organizationId, Map<String, String> cache) {
        if (organizationId == null || organizationId.isBlank()) return null;
        if (cache == null) return resolveOrganizationName(organizationId);
        return cache.computeIfAbsent(organizationId, this::resolveOrganizationName);
    }

    private void computeTimeline(PatientCareRecord record) {
        IncidentTimeline tl = record.getTimeline();
        if (tl != null) {
            if (tl.getArrivedSceneAt() != null && tl.getCallReceivedAt() != null) {
                tl.setResponseTimeMinutes(ChronoUnit.MINUTES.between(tl.getCallReceivedAt(), tl.getArrivedSceneAt()));
            }
            if (tl.getDepartedSceneAt() != null && tl.getArrivedSceneAt() != null) {
                tl.setSceneTimeMinutes(ChronoUnit.MINUTES.between(tl.getArrivedSceneAt(), tl.getDepartedSceneAt()));
            }
            if (tl.getArrivedDestinationAt() != null && tl.getDepartedSceneAt() != null) {
                tl.setTransportTimeMinutes(ChronoUnit.MINUTES.between(tl.getDepartedSceneAt(), tl.getArrivedDestinationAt()));
            }
            if (tl.getTransferOfCareAt() != null && tl.getCallReceivedAt() != null) {
                tl.setTotalCallTimeMinutes(ChronoUnit.MINUTES.between(tl.getCallReceivedAt(), tl.getTransferOfCareAt()));
            }
            record.setTimeline(tl);
        }
    }

    private String resolveIpAddress() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttrs) {
            HttpServletRequest request = servletAttrs.getRequest();
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
            return request.getRemoteAddr();
        }
        return "N/A";
    }

    private List<AuditLog.FieldChange> diffObjects(Object oldObj, Object newObj) {
        List<AuditLog.FieldChange> changes = new ArrayList<>();
        if (oldObj == null || newObj == null) return changes;
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
            
            // Ignore auditTrail, updatedAt, etc from diff
            Map<String, Object> oldMap = mapper.convertValue(oldObj, new TypeReference<Map<String, Object>>() {});
            Map<String, Object> newMap = mapper.convertValue(newObj, new TypeReference<Map<String, Object>>() {});
            
            for (String key : newMap.keySet()) {
                if ("auditTrail".equals(key) || "updatedAt".equals(key)) continue;
                Object oldVal = oldMap.get(key);
                Object newVal = newMap.get(key);
                if (!Objects.equals(oldVal, newVal)) {
                    String oldStr = oldVal == null ? "null" : oldVal.toString();
                    String newStr = newVal == null ? "null" : newVal.toString();
                    changes.add(new AuditLog.FieldChange(key, oldStr, newStr));
                }
            }
        } catch (Exception e) {
            // Ignore diff errors
        }
        return changes;
    }

    private void upsertPatientPortalAccount(String patientId, String organizationId, String email, String phone) {
        String normalizedEmail = email == null ? null : email.trim();
        String normalizedPhone = phone == null ? null : phone.trim();
        if ((normalizedEmail == null || normalizedEmail.isBlank())
                && (normalizedPhone == null || normalizedPhone.isBlank())
                && (patientId == null || patientId.isBlank())) {
            return;
        }

        Patient patient = null;
        if (normalizedEmail != null && !normalizedEmail.isBlank()) {
            patient = patientRepository.findByEmail(normalizedEmail).orElse(null);
        }
        if (patient == null && normalizedPhone != null && !normalizedPhone.isBlank()) {
            patient = patientRepository.findByPhone(normalizedPhone).orElse(null);
        }
        if (patient == null && patientId != null && !patientId.isBlank()) {
            patient = patientRepository.findByPatientId(patientId).orElse(null);
        }
        if (patient == null) {
            patient = new Patient();
            patient.setCreatedAt(LocalDateTime.now());
            patient.setOtpHash(passwordEncoder.encode("123456"));
            patient.setOtpExpiresAt(LocalDateTime.now().plusMinutes(1));
            patient.setLastLoginAt(null);
        }

        String resolvedPatientId = (patientId != null && !patientId.isBlank())
                ? patientId.trim()
                : (patient.getPatientId() != null && !patient.getPatientId().isBlank()
                    ? patient.getPatientId()
                    : "PAT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));

        patient.setPatientId(resolvedPatientId);
        patient.setOrganizationId(organizationId);
        if (normalizedEmail != null && !normalizedEmail.isBlank()) {
            patient.setEmail(normalizedEmail);
        }
        if (normalizedPhone != null && !normalizedPhone.isBlank()) {
            patient.setPhone(normalizedPhone);
        }
        patient.setActive(true);
        patient.setUpdatedAt(LocalDateTime.now());
        patientRepository.save(patient);
    }

    private String resolvePatientId(CreatePatientCareRecordRequest request) {
        if (request.getPatientId() != null && !request.getPatientId().isBlank()) {
            String requestedPatientId = request.getPatientId().trim();
            Optional<Patient> patient = patientRepository.findByPatientId(requestedPatientId);
            if (patient.isPresent()) {
                accessControlService.assertOrganizationAccess(patient.get().getOrganizationId());
                return requestedPatientId;
            }
            PatientCareRecord latestRecord = findLatestRecordForPatient(requestedPatientId)
                    .orElseThrow(() -> new ResourceNotFoundException("Patient not found with id: " + requestedPatientId));
            accessControlService.assertOrganizationAccess(latestRecord.getOrganizationId());
            return requestedPatientId;
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            Optional<Patient> patient = patientRepository.findByEmail(request.getEmail().trim());
            if (patient.isPresent() && patient.get().getPatientId() != null && !patient.get().getPatientId().isBlank()) {
                return patient.get().getPatientId();
            }
        }
        if (request.getPatientPhone() != null && !request.getPatientPhone().isBlank()) {
            Optional<Patient> patient = patientRepository.findByPhone(request.getPatientPhone().trim());
            if (patient.isPresent() && patient.get().getPatientId() != null && !patient.get().getPatientId().isBlank()) {
                return patient.get().getPatientId();
            }
        }
        return generateUniquePatientId();
    }

    private Optional<PatientCareRecord> findLatestRecordForPatient(String patientId) {
        if (patientId == null || patientId.isBlank()) {
            return Optional.empty();
        }
        return recordRepository.findByPatientId(patientId).stream()
                .filter(this::canAccessRecord)
                .max((left, right) -> {
                    LocalDateTime leftTime = left.getUpdatedAt() == null ? left.getCreatedAt() : left.getUpdatedAt();
                    LocalDateTime rightTime = right.getUpdatedAt() == null ? right.getCreatedAt() : right.getUpdatedAt();
                    if (leftTime == null && rightTime == null) return 0;
                    if (leftTime == null) return -1;
                    if (rightTime == null) return 1;
                    return leftTime.compareTo(rightTime);
                })
                .map(this::copyWithDecryptedPhi);
    }

    private String generateUniquePatientId() {
        String patientId;
        do {
            patientId = "PAT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (patientRepository.existsByPatientId(patientId) || recordRepository.existsByPatientId(patientId));
        return patientId;
    }

    private String generateUniqueIncidentNumber() {
        String datePart = LocalDateTime.now().toLocalDate().toString().replace("-", "");
        String incidentNumber;
        do {
            incidentNumber = "INC-" + datePart + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
        } while (recordRepository.existsByIncidentNumber(incidentNumber));
        return incidentNumber;
    }

    private void ensurePendingQaReviewExists(PatientCareRecord record) {
        if (record == null || record.getId() == null || record.getId().isBlank()) {
            return;
        }

        List<QAReview> existingReviews = qaReviewRepository.findByPatientCareRecordId(record.getId());
        if (existingReviews != null && !existingReviews.isEmpty()) {
            return;
        }

        String organizationId = record.getOrganizationId();
        String qaFormId = null;
        if (organizationId != null && !organizationId.isBlank()) {
            qaFormId = qaFormRepository.findByOrganizationId(organizationId).stream()
                    .filter(f -> Boolean.TRUE.equals(f.getActive()))
                    .map(QAForm::getId)
                    .findFirst()
                    .orElse(null);
        }
        if (qaFormId == null) {
            qaFormId = qaFormRepository.findByActive(true).stream()
                    .map(QAForm::getId)
                    .findFirst()
                    .orElse(null);
        }

        QAReview pendingReview = new QAReview();
        pendingReview.setPatientCareRecordId(record.getId());
        pendingReview.setQaFormId(qaFormId);
        pendingReview.setReviewerId(null);
        pendingReview.setResponses(new ArrayList<>());
        pendingReview.setScore(null);
        pendingReview.setPassed(null);
        pendingReview.setFeedback("Auto-created on EPCR submission");
        pendingReview.setStatus("QA_PENDING");
        pendingReview.setCreatedAt(LocalDateTime.now());
        pendingReview.setUpdatedAt(LocalDateTime.now());
        pendingReview.setCompletedAt(null);
        qaReviewRepository.save(pendingReview);
    }

    private void notifyQaReviewersOnCreate(PatientCareRecord record, User paramedic) {
        String patientName = phiCryptoService.decrypt(record.getPatientName());
        if (patientName == null || patientName.isBlank()) {
            patientName = "Anonymous Patient";
        }
        notifyQaReviewers(
                record,
                "New ePCR Record Created - " + patientName,
                "Record " + recordLabel(record) + " for patient " + patientName 
                        + " was created by paramedic " + buildUserDisplayName(paramedic) + "."
        );
    }

    private void notifyQaReviewersOnSubmit(PatientCareRecord record, User paramedic) {
        String patientName = phiCryptoService.decrypt(record.getPatientName());
        if (patientName == null || patientName.isBlank()) {
            patientName = "Anonymous Patient";
        }
        notifyQaReviewers(
                record,
                "QA Review Queue: " + patientName,
                "A new ePCR Record #" + recordLabel(record) + " for patient " + patientName
                        + " has been submitted by paramedic " + buildUserDisplayName(paramedic)
                        + " and is now ready for QA review."
        );
    }

    private void notifyQaReviewers(PatientCareRecord record, String title, String message) {
        if (record == null || record.getOrganizationId() == null || record.getOrganizationId().isBlank()) {
            return;
        }
        userRepository.findByOrganizationIdAndRole(record.getOrganizationId(), Role.QA_REVIEWER).stream()
                .filter(user -> Boolean.TRUE.equals(user.getActive()))
                .forEach(user -> {
                    Notification notification = new Notification();
                    notification.setRecipientId(user.getId());
                    notification.setType("INFO");
                    notification.setTitle(title);
                    notification.setMessage(message);
                    notification.setRelatedEntityId(record.getId());
                    notification.setRelatedEntityType("PatientCareRecord");
                    notificationService.createNotification(notification);
                });
    }

    private String recordLabel(PatientCareRecord record) {
        if (record == null) {
            return "unknown";
        }
        return record.getIncidentNumber() == null || record.getIncidentNumber().isBlank()
                ? record.getId()
                : record.getIncidentNumber();
    }

    private void evictPatientSearchCache(String organizationId) {
        patientSearchCacheService.evictSearchCacheForOrganization(organizationId);
    }

    private void createHistoryEncounter(PatientCareRecord record) {
        if (record == null || record.getPatientId() == null || record.getPatientId().isBlank()
                || record.getId() == null || record.getId().isBlank()) {
            return;
        }
        PatientCareRecord decrypted = copyWithDecryptedPhi(record);
        PatientEncounter encounter = new PatientEncounter();
        encounter.setEpcrRecordId(record.getId());
        encounter.setDate(record.getIncidentDateTime() == null ? null : record.getIncidentDateTime().toLocalDate());
        encounter.setChiefComplaint(firstNonBlank(
                decrypted.getPrimaryImpression(),
                decrypted.getIncidentDescription(),
                decrypted.getDiagnosis(),
                firstValue(decrypted.getComplaints())
        ));
        encounter.setOutcome(resolveEncounterOutcome(decrypted));
        encounter.setNotes(buildHistoryEncounterNotes(decrypted));
        patientHistoryService.createEncounter(record.getPatientId(), encounter);
    }

    private String buildHistoryEncounterNotes(PatientCareRecord record) {
        List<String> bullets = new ArrayList<>();
        bullets.add("Auto-linked from ePCR " + recordLabel(record));
        addBullet(bullets, "Treatment", record.getTreatmentProvided());
        addBullet(bullets, "Treatment plan", record.getTreatmentPlan());
        addBullets(bullets, "Diet advice", record.getDietAdvice());
        addBullets(bullets, "Notes", record.getNotes());
        if (record.getMedicalHistory() != null) {
            addBullets(bullets, "Medical history notes", record.getMedicalHistory().getNotes());
        }
        return bullets.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> "- " + value)
                .collect(Collectors.joining("\n"));
    }

    private void addBullet(List<String> bullets, String label, String value) {
        if (value != null && !value.isBlank()) {
            bullets.add(label + ": " + value.trim());
        }
    }

    private void addBullets(List<String> bullets, String label, List<String> values) {
        if (values == null) {
            return;
        }
        values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .forEach(value -> bullets.add(label + ": " + value));
    }

    private String resolveEncounterOutcome(PatientCareRecord record) {
        if (record.getTransportDestination() != null && !record.getTransportDestination().isBlank()) {
            return "Transported to " + record.getTransportDestination();
        }
        if (record.getTransportMode() != null && !record.getTransportMode().isBlank()) {
            return "Transported";
        }
        return toCanonicalStatus(record);
    }

    private String firstValue(List<String> values) {
        if (values == null) {
            return null;
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
    }

    private <T> T valueFrom(PatientCareRecord record, Function<PatientCareRecord, T> getter) {
        return record == null ? null : getter.apply(record);
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

    private String computeClinicalTag(
            String incidentType,
            String diagnosis,
            String primaryImpression,
            String incidentDescription,
            List<String> complaints) {
        if (incidentType == null) return null;
        String rawType = incidentType.toUpperCase();

        StringBuilder sb = new StringBuilder();
        if (diagnosis != null) sb.append(diagnosis).append(" ");
        if (primaryImpression != null) sb.append(primaryImpression).append(" ");
        if (incidentDescription != null) sb.append(incidentDescription).append(" ");
        if (complaints != null) {
            for (String c : complaints) {
                if (c != null) sb.append(c).append(" ");
            }
        }
        String textToAnalyze = sb.toString().toLowerCase();

        // Dental category
        if (rawType.equals("DENTIST") || rawType.equals("DENTAL") || rawType.contains("DENT")) {
            if (textToAnalyze.contains("implant")) return "Implant Case";
            if (textToAnalyze.contains("crown") || textToAnalyze.contains("bridge")) return "Crown / Bridge";
            if (textToAnalyze.contains("root canal") || textToAnalyze.contains("pulpectomy") || textToAnalyze.contains("endo")) return "Root Canal";
            if (textToAnalyze.contains("extraction") || textToAnalyze.contains("tooth removal")) return "Extraction";
            if (textToAnalyze.contains("filling") || textToAnalyze.contains("caries") || textToAnalyze.contains("cavity") || textToAnalyze.contains("decay")) return "Restoration";
            if (textToAnalyze.contains("braces") || textToAnalyze.contains("ortho")) return "Orthodontics";
            if (textToAnalyze.contains("cleaning") || textToAnalyze.contains("scaling") || textToAnalyze.contains("prophy")) return "Prophylaxis";
            return "Dental Care";
        }

        // Cardiology category
        if (rawType.contains("CARDIO") || rawType.contains("HEART")) {
            if (textToAnalyze.contains("arrest")) return "Cardiac Arrest";
            if (textToAnalyze.contains("infarction") || textToAnalyze.contains("heart attack") || textToAnalyze.contains("mi")) return "Myocardial Infarction";
            if (textToAnalyze.contains("arrhythmia") || textToAnalyze.contains("fibrillation") || textToAnalyze.contains("afib")) return "Arrhythmia";
            if (textToAnalyze.contains("heart failure") || textToAnalyze.contains("chf")) return "Heart Failure";
            if (textToAnalyze.contains("angina")) return "Angina";
            return "Cardiac Case";
        }

        // Respiratory category
        if (rawType.contains("RESPIRATORY") || rawType.contains("LUNG") || rawType.contains("BREATH")) {
            if (textToAnalyze.contains("asthma")) return "Asthma Flare";
            if (textToAnalyze.contains("copd")) return "COPD Exacerbation";
            if (textToAnalyze.contains("pneumonia")) return "Pneumonia";
            if (textToAnalyze.contains("bronchitis")) return "Bronchitis";
            if (textToAnalyze.contains("apnea") || textToAnalyze.contains("failure")) return "Respiratory Failure";
            return "Respiratory Case";
        }

        // Neurology category
        if (rawType.contains("NEURO") || rawType.contains("BRAIN")) {
            if (textToAnalyze.contains("stroke") || textToAnalyze.contains("cva") || textToAnalyze.contains("tia")) return "Stroke / TIA";
            if (textToAnalyze.contains("seizure") || textToAnalyze.contains("epilepsy") || textToAnalyze.contains("fit")) return "Seizure Activity";
            if (textToAnalyze.contains("concussion") || textToAnalyze.contains("tbi") || textToAnalyze.contains("head")) return "Head Injury / TBI";
            return "Neurology Case";
        }

        // Obstetric category
        if (rawType.contains("OBSTETRIC") || rawType.contains("PREGNAN") || rawType.contains("MATERNITY")) {
            if (textToAnalyze.contains("labor") || textToAnalyze.contains("delivery") || textToAnalyze.contains("birth")) return "Active Labor";
            if (textToAnalyze.contains("miscarriage") || textToAnalyze.contains("abortion")) return "Miscarriage Risk";
            return "Pregnancy Case";
        }

        // Trauma / Emergency category
        if (rawType.contains("TRAUMA") || rawType.contains("ACCIDENT")) {
            if (textToAnalyze.contains("fracture")) return "Fracture";
            if (textToAnalyze.contains("fall")) return "Fall Injury";
            if (textToAnalyze.contains("burn")) return "Burn Injury";
            if (textToAnalyze.contains("accident") || textToAnalyze.contains("collision") || textToAnalyze.contains("mva")) return "Accident / MVA";
            if (textToAnalyze.contains("laceration") || textToAnalyze.contains("wound") || textToAnalyze.contains("cut")) return "Wound / Laceration";
            return "Trauma Case";
        }

        // Oncology category
        if (rawType.contains("ONCOLOGY") || rawType.contains("CANCER")) {
            if (textToAnalyze.contains("chemo")) return "Chemotherapy";
            if (textToAnalyze.contains("biopsy")) return "Biopsy";
            if (textToAnalyze.contains("radiation") || textToAnalyze.contains("radiotherapy")) return "Radiotherapy";
            return "Oncology Case";
        }

        // Fallback to explicit primaryImpression or diagnosis if set and short enough
        if (primaryImpression != null && !primaryImpression.isBlank()) {
            return primaryImpression.length() > 22 ? primaryImpression.substring(0, 20) + "..." : primaryImpression;
        }
        if (diagnosis != null && !diagnosis.isBlank()) {
            return diagnosis.length() > 22 ? diagnosis.substring(0, 20) + "..." : diagnosis;
        }

        return null;
    }

    @PostConstruct

    public void runTagMigration() {
        new Thread(() -> {
            try {
                // Wait for DB connections to settle
                Thread.sleep(4000);

                Query query = new Query(new Criteria().orOperator(
                        Criteria.where("clinicalTag").exists(false),
                        Criteria.where("clinicalTag").is(null),
                        Criteria.where("clinicalTag").is("")
                ));

                List<PatientCareRecord> recordsToMigrate = mongoTemplate.find(query, PatientCareRecord.class);
                if (recordsToMigrate.isEmpty()) {
                    log.info("No records require clinical tag migration.");
                    return;
                }

                log.info("Starting clinical tag migration for {} records...", recordsToMigrate.size());
                int migratedCount = 0;
                for (PatientCareRecord r : recordsToMigrate) {
                    PatientCareRecord decrypted = copyWithDecryptedPhi(r);
                    String tag = computeClinicalTag(
                            decrypted.getIncidentType(),
                            decrypted.getDiagnosis(),
                            decrypted.getPrimaryImpression(),
                            decrypted.getIncidentDescription(),
                            decrypted.getComplaints()
                    );

                    if (tag != null && !tag.isBlank()) {
                        Query updateQuery = new Query(Criteria.where("_id").is(r.getId()));
                        Update update = new Update();
                        update.set("clinicalTag", tag);
                        mongoTemplate.updateFirst(updateQuery, update, PatientCareRecord.class);
                        migratedCount++;
                    }
                }
                log.info("Completed clinical tag migration: {}/{} records updated.", migratedCount, recordsToMigrate.size());
            } catch (Exception e) {
                log.error("Failed to run clinical tag migration", e);
            }
        }).start();
    }
}

