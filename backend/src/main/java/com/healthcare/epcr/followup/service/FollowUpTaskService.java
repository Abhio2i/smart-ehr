package com.healthcare.epcr.followup.service;

import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.followup.dto.FollowUpTaskDTO;
import com.healthcare.epcr.followup.model.FollowUpTask;
import com.healthcare.epcr.followup.repository.FollowUpTaskRepository;
import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import com.healthcare.epcr.patienthistory.model.PatientVital;
import com.healthcare.epcr.common.dto.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@Service
@RequiredArgsConstructor
@Slf4j
public class FollowUpTaskService {
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_SENT = "SENT";
    public static final String STATUS_FAILED = "FAILED";

    private final FollowUpTaskRepository followUpTaskRepository;
    private final PatientCareRecordRepository recordRepository;
    private final EmailService emailService;
    private final PhiCryptoService phiCryptoService;
    private final AccessControlService accessControlService;

    @Value("${followup.enabled:true}")
    private boolean followUpEnabled;

    @Value("${followup.days-after-incident:7}")
    private long daysAfterIncident;

    @Value("${followup.max-daily-emails:500}")
    private int maxDailyEmails;

    @Value("${followup.max-incident-age-days:14}")
    private long maxIncidentAgeDays;

    public void scheduleIfCritical(PatientCareRecord record) {
        if (!followUpEnabled || record == null || record.getId() == null || record.getId().isBlank()) {
            return;
        }

        FollowUpTask existingTask = followUpTaskRepository.findByRecordId(record.getId()).orElse(null);

        boolean eligible = record.getStatus() == RecordStatus.SUBMITTED
                || record.getStatus() == RecordStatus.APPROVED
                || record.getStatus() == RecordStatus.COMPLETED;

        if (!eligible) {
            if (existingTask != null && STATUS_PENDING.equals(existingTask.getStatus())) {
                followUpTaskRepository.delete(existingTask);
                log.info("Deleted pending critical follow-up task for recordId={} because the record status is no longer eligible ({})", record.getId(), record.getStatus());
            }
            return;
        }

        CriticalAssessment assessment = assessCritical(record);
        if (!assessment.critical()) {
            if (existingTask != null && STATUS_PENDING.equals(existingTask.getStatus())) {
                followUpTaskRepository.delete(existingTask);
                log.info("Deleted pending critical follow-up task for recordId={} because it is no longer critical", record.getId());
            }
            return;
        }

        String patientEmail = record.getEmail();
        if (patientEmail == null || patientEmail.isBlank()) {
            if (existingTask != null && STATUS_PENDING.equals(existingTask.getStatus())) {
                followUpTaskRepository.delete(existingTask);
                log.info("Deleted pending critical follow-up task for recordId={} because patient email is missing", record.getId());
            } else {
                log.warn("Critical follow-up not scheduled because patient email is missing. recordId={}", record.getId());
            }
            return;
        }

        LocalDate incidentDate = resolveIncidentDate(record);
        if (incidentDate.isBefore(LocalDate.now().minusDays(maxIncidentAgeDays))) {
            if (existingTask != null && STATUS_PENDING.equals(existingTask.getStatus())) {
                followUpTaskRepository.delete(existingTask);
                log.info("Deleted pending critical follow-up task for recordId={} because incident date {} is older than {} days", 
                        record.getId(), incidentDate, maxIncidentAgeDays);
            } else {
                log.info("Critical follow-up not scheduled because incident date {} is older than {} days. recordId={}", 
                        incidentDate, maxIncidentAgeDays, record.getId());
            }
            return;
        }

        FollowUpTask task;
        boolean isNew = false;

        if (existingTask == null) {
            task = new FollowUpTask();
            task.setCreatedAt(LocalDateTime.now());
            task.setStatus(STATUS_PENDING);
            task.setAttemptCount(0);
            isNew = true;
        } else {
            if (STATUS_SENT.equals(existingTask.getStatus())) {
                return;
            }
            task = existingTask;
        }

        task.setPatientId(record.getPatientId());
        task.setRecordId(record.getId());
        task.setOrganizationId(record.getOrganizationId());
        task.setParamedicsId(record.getParamedicsId());
        task.setPatientEmail(patientEmail);
        task.setPatientName(record.getPatientName());
        task.setIncidentNumber(record.getIncidentNumber());
        task.setIncidentDate(incidentDate);
        task.setDueDate(incidentDate.plusDays(daysAfterIncident));
        task.setTriggeredByRule("CRITICAL_EPCR_FOLLOW_UP");
        task.setCriticalReasons(assessment.reasons());
        task.setSourceType("EPCR");
        task.setUpdatedAt(LocalDateTime.now());

        if (STATUS_FAILED.equals(task.getStatus())) {
            task.setStatus(STATUS_PENDING);
            task.setAttemptCount(0);
            task.setLastError(null);
        }

        followUpTaskRepository.save(task);
        if (isNew) {
            log.info("Scheduled critical follow-up task for recordId={} dueDate={}", record.getId(), task.getDueDate());
        } else {
            log.info("Updated pending/failed critical follow-up task for recordId={} dueDate={}", record.getId(), task.getDueDate());
        }
    }

    public void scheduleIfCritical(PatientVital vital, String patientName, String patientEmail) {
        if (!followUpEnabled || vital == null || vital.getId() == null || vital.getId().isBlank()) {
            return;
        }

        FollowUpTask existingTask = followUpTaskRepository.findByRecordId(vital.getId()).orElse(null);

        // Map vital to mock PatientCareRecord for assessment
        PatientCareRecord mockRecord = new PatientCareRecord();
        mockRecord.setId(vital.getId());
        mockRecord.setPatientId(vital.getPatientId());
        mockRecord.setPatientName(patientName);
        mockRecord.setEmail(patientEmail);
        mockRecord.setOrganizationId(vital.getOrganizationId());
        mockRecord.setIncidentDateTime(vital.getRecordedAt());
        mockRecord.setStatus(RecordStatus.SUBMITTED);

        // Copy vitals
        mockRecord.setSpo2(vital.getOxygenSaturation());
        mockRecord.setSystolicBp(vital.getSystolicBP());
        mockRecord.setDiastolicBp(vital.getDiastolicBP());
        mockRecord.setHeartRate(vital.getHeartRate());
        mockRecord.setPulseRate(vital.getPulseRate());
        mockRecord.setRespirationRate(vital.getRespiratoryRate());
        mockRecord.setBloodSugar(vital.getBloodGlucose());
        mockRecord.setTemperature(vital.getTemperature());
        mockRecord.setHemoglobin(vital.getHemoglobin());

        CriticalAssessment assessment = assessCritical(mockRecord);
        if (!assessment.critical()) {
            if (existingTask != null && STATUS_PENDING.equals(existingTask.getStatus())) {
                followUpTaskRepository.delete(existingTask);
                log.info("Deleted pending history vital follow-up task for vitalId={} because it is no longer critical", vital.getId());
            }
            return;
        }

        if (patientEmail == null || patientEmail.isBlank()) {
            if (existingTask != null && STATUS_PENDING.equals(existingTask.getStatus())) {
                followUpTaskRepository.delete(existingTask);
                log.info("Deleted pending history vital follow-up task for vitalId={} because patient email is missing", vital.getId());
            } else {
                log.warn("History vital follow-up not scheduled because patient email is missing. vitalId={}", vital.getId());
            }
            return;
        }

        LocalDate incidentDate = resolveIncidentDate(mockRecord);
        if (incidentDate.isBefore(LocalDate.now().minusDays(maxIncidentAgeDays))) {
            if (existingTask != null && STATUS_PENDING.equals(existingTask.getStatus())) {
                followUpTaskRepository.delete(existingTask);
                log.info("Deleted pending history vital follow-up task for vitalId={} because incident date {} is older than {} days", 
                        vital.getId(), incidentDate, maxIncidentAgeDays);
            } else {
                log.info("History vital follow-up not scheduled because incident date {} is older than {} days. vitalId={}", 
                        incidentDate, maxIncidentAgeDays, vital.getId());
            }
            return;
        }

        FollowUpTask task;
        boolean isNew = false;

        if (existingTask == null) {
            task = new FollowUpTask();
            task.setCreatedAt(LocalDateTime.now());
            task.setStatus(STATUS_PENDING);
            task.setAttemptCount(0);
            isNew = true;
        } else {
            if (STATUS_SENT.equals(existingTask.getStatus())) {
                return;
            }
            task = existingTask;
        }

        task.setPatientId(vital.getPatientId());
        task.setRecordId(vital.getId());
        task.setOrganizationId(vital.getOrganizationId());
        task.setParamedicsId(vital.getRecordedBy());
        task.setPatientEmail(patientEmail);
        task.setPatientName(patientName);
        task.setIncidentNumber("VITAL-" + vital.getId().substring(Math.max(0, vital.getId().length() - 8)));
        task.setIncidentDate(incidentDate);
        task.setDueDate(incidentDate.plusDays(daysAfterIncident));
        task.setTriggeredByRule("CRITICAL_HISTORY_VITAL_FOLLOW_UP");
        task.setCriticalReasons(assessment.reasons());
        task.setSourceType("PATIENT_HISTORY");
        task.setVitalId(vital.getId());
        task.setUpdatedAt(LocalDateTime.now());

        if (STATUS_FAILED.equals(task.getStatus())) {
            task.setStatus(STATUS_PENDING);
            task.setAttemptCount(0);
            task.setLastError(null);
        }

        followUpTaskRepository.save(task);
        if (isNew) {
            log.info("Scheduled critical history vital follow-up task for vitalId={} dueDate={}", vital.getId(), task.getDueDate());
        } else {
            log.info("Updated pending/failed critical history vital follow-up task for vitalId={} dueDate={}", vital.getId(), task.getDueDate());
        }
    }

    public int sendDueFollowUps(LocalDate today) {
        if (!followUpEnabled) {
            return 0;
        }
        List<FollowUpTask> dueTasks = followUpTaskRepository
                .findByDueDateLessThanEqualAndStatusOrderByDueDateAsc(today, STATUS_PENDING);
        int sent = 0;
        for (FollowUpTask task : dueTasks) {
            if (sent >= maxDailyEmails) {
                log.warn("Follow-up daily email cap reached: {}", maxDailyEmails);
                break;
            }
            if (sendFollowUp(task)) {
                sent++;
            }
        }
        return sent;
    }

    public int backfillMissingTasks() {
        if (!followUpEnabled) {
            return 0;
        }
        int created = 0;
        List<RecordStatus> eligibleStatuses = List.of(RecordStatus.SUBMITTED, RecordStatus.APPROVED, RecordStatus.COMPLETED);
        for (RecordStatus status : eligibleStatuses) {
            for (PatientCareRecord record : recordRepository.findByStatus(status)) {
                boolean existed = record.getId() != null && followUpTaskRepository.existsByRecordId(record.getId());
                scheduleIfCritical(record);
                if (!existed && record.getId() != null && followUpTaskRepository.existsByRecordId(record.getId())) {
                    created++;
                }
            }
        }
        return created;
    }

    public PageResponse<FollowUpTaskDTO> listVisibleTasks(String status, int page, int size) {
        User currentUser = accessControlService.currentUser();
        if (currentUser.getOrganizationId() == null || currentUser.getOrganizationId().isBlank()) {
            throw new IllegalArgumentException("organizationId is required for follow-up task listing");
        }

        String normalizedStatus = normalizeStatus(status);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "dueDate")
                .and(Sort.by(Sort.Direction.DESC, "createdAt")));

        Page<FollowUpTask> tasksPage;
        if (currentUser.getRole() == Role.PARAMEDIC) {
            tasksPage = normalizedStatus == null
                    ? followUpTaskRepository.findByOrganizationIdAndParamedicsId(currentUser.getOrganizationId(), currentUser.getId(), pageable)
                    : followUpTaskRepository.findByOrganizationIdAndParamedicsIdAndStatus(currentUser.getOrganizationId(), currentUser.getId(), normalizedStatus, pageable);
        } else {
            tasksPage = normalizedStatus == null
                    ? followUpTaskRepository.findByOrganizationId(currentUser.getOrganizationId(), pageable)
                    : followUpTaskRepository.findByOrganizationIdAndStatus(currentUser.getOrganizationId(), normalizedStatus, pageable);
        }

        List<FollowUpTaskDTO> content = tasksPage.getContent().stream()
                .map(this::mapToDTO)
                .toList();

        return new PageResponse<>(
                content,
                tasksPage.getNumber(),
                tasksPage.getSize(),
                tasksPage.getTotalElements(),
                tasksPage.getTotalPages(),
                tasksPage.isLast()
        );
    }

    private boolean sendFollowUp(FollowUpTask task) {
        task.setAttemptCount(task.getAttemptCount() == null ? 1 : task.getAttemptCount() + 1);
        task.setLastAttemptAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());

        String patientEmail = phiCryptoService.decrypt(task.getPatientEmail());
        if (patientEmail == null || patientEmail.isBlank()) {
            task.setStatus(STATUS_FAILED);
            task.setLastError("Patient email is missing");
            followUpTaskRepository.save(task);
            return false;
        }

        try {
            emailService.sendEmailNow(patientEmail, buildSubject(task), buildBody(task));
            task.setStatus(STATUS_SENT);
            task.setSentAt(LocalDateTime.now());
            task.setLastError(null);
            task.setUpdatedAt(LocalDateTime.now());
            followUpTaskRepository.save(task);
            return true;
        } catch (RuntimeException ex) {
            task.setLastError(ex.getMessage());
            task.setUpdatedAt(LocalDateTime.now());
            followUpTaskRepository.save(task);
            log.error("Critical follow-up email failed for taskId={} recordId={}", task.getId(), task.getRecordId(), ex);
            return false;
        }
    }

    private CriticalAssessment assessCritical(PatientCareRecord record) {
        Set<String> reasons = new LinkedHashSet<>();
        addIf(reasons, record.getSpo2() != null && record.getSpo2() < 92, "Low SpO2");
        addIf(reasons, record.getSystolicBp() != null && record.getSystolicBp() >= 180, "Very high systolic BP");
        addIf(reasons, record.getDiastolicBp() != null && record.getDiastolicBp() >= 120, "Very high diastolic BP");
        addIf(reasons, record.getHeartRate() != null && (record.getHeartRate() > 130 || record.getHeartRate() < 40), "Critical heart rate");
        addIf(reasons, record.getPulseRate() != null && (record.getPulseRate() > 130 || record.getPulseRate() < 40), "Critical pulse rate");
        addIf(reasons, record.getRespirationRate() != null && (record.getRespirationRate() > 30 || record.getRespirationRate() < 8), "Critical respiration rate");
        addIf(reasons, record.getBloodSugar() != null && (record.getBloodSugar() >= 300 || record.getBloodSugar() <= 60), "Critical blood sugar");
        addIf(reasons, record.getTemperature() != null && (record.getTemperature() >= 39.5 || record.getTemperature() <= 35.0), "Critical temperature");
        addIf(reasons, record.getHemoglobin() != null && record.getHemoglobin() <= 7.0, "Critical hemoglobin");
        addIf(reasons, containsCriticalText(record.getCareLevel()), "Critical care level");
        return new CriticalAssessment(!reasons.isEmpty(), new ArrayList<>(reasons));
    }

    private void addIf(Set<String> reasons, boolean condition, String reason) {
        if (condition) {
            reasons.add(reason);
        }
    }

    private boolean containsCriticalText(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = value.toLowerCase();
        return normalized.contains("critical") || normalized.contains("emergency") || normalized.contains("icu");
    }

    private LocalDate resolveIncidentDate(PatientCareRecord record) {
        if (record.getIncidentDateTime() != null) {
            return record.getIncidentDateTime().toLocalDate();
        }
        if (record.getSubmittedAt() != null) {
            return record.getSubmittedAt().toLocalDate();
        }
        if (record.getCreatedAt() != null) {
            return record.getCreatedAt().toLocalDate();
        }
        return LocalDate.now();
    }

    private String buildSubject(FollowUpTask task) {
        return "Important follow-up recommended after your recent emergency care";
    }

    private String buildBody(FollowUpTask task) {
        String patientName = phiCryptoService.decrypt(task.getPatientName());
        String greetingName = patientName == null || patientName.isBlank() ? "Patient" : patientName;
        String incidentLabel = task.getIncidentNumber() == null || task.getIncidentNumber().isBlank()
                ? task.getRecordId()
                : task.getIncidentNumber();

        return """
                <p>Dear %s,</p>
                <p>Our care team recommends a follow-up appointment after your recent emergency care event.</p>
                <p><strong>Record:</strong> %s<br/>
                <strong>Recommended follow-up date:</strong> %s</p>
                <p>Please contact your doctor, clinic, or care team to review your recovery and next steps.</p>
                <p>If you are having chest pain, severe breathing difficulty, fainting, confusion, or any worsening symptoms, seek emergency care immediately.</p>
                <p>Regards,<br/>Healthcare ePCR Care Team</p>
                """.formatted(greetingName, incidentLabel, task.getDueDate());
    }

    private boolean canCurrentUserSeeTask(User currentUser, FollowUpTask task) {
        if (currentUser.getRole() == Role.ADMIN
                || currentUser.getRole() == Role.MANAGER
                || currentUser.getRole() == Role.QA_REVIEWER
                || currentUser.getRole() == Role.PHYSICIAN) {
            return true;
        }
        if (currentUser.getRole() == Role.PARAMEDIC) {
            return task.getParamedicsId() != null && task.getParamedicsId().equals(currentUser.getId());
        }
        return false;
    }

    private FollowUpTaskDTO mapToDTO(FollowUpTask task) {
        return new FollowUpTaskDTO(
                task.getId(),
                task.getPatientId(),
                task.getRecordId(),
                task.getOrganizationId(),
                task.getParamedicsId(),
                phiCryptoService.decrypt(task.getPatientEmail()),
                phiCryptoService.decrypt(task.getPatientName()),
                task.getIncidentNumber(),
                task.getIncidentDate(),
                task.getDueDate(),
                task.getStatus(),
                task.getTriggeredByRule(),
                task.getCriticalReasons(),
                task.getAttemptCount(),
                task.getLastAttemptAt(),
                task.getSentAt(),
                task.getLastError()
        );
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase();
        if (!List.of(STATUS_PENDING, STATUS_SENT, STATUS_FAILED).contains(normalized)) {
            throw new IllegalArgumentException("Unsupported follow-up status: " + status);
        }
        return normalized;
    }

    private record CriticalAssessment(boolean critical, List<String> reasons) {
    }
}
