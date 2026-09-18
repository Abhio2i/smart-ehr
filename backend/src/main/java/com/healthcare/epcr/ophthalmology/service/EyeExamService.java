package com.healthcare.epcr.ophthalmology.service;

import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.ophthalmology.dto.EyeExamRequest;
import com.healthcare.epcr.ophthalmology.entity.EyeExam;
import com.healthcare.epcr.ophthalmology.repository.EyeExamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EyeExamService {

    private final EyeExamRepository eyeExamRepository;
    private final PhiCryptoService phiCryptoService;
    private final StringRedisTemplate redisTemplate;

    // Same idempotency-key pattern used by /api/epcr/records and /api/waitlist/entries
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);
    private static final String IDEMPOTENCY_PREFIX = "idempotency:eye-exam:";

    @Transactional
    public EyeExam createEyeExam(EyeExamRequest request, String idempotencyKey,
                                  String currentUserId, String currentUserName,
                                  String organizationId) {

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            String cachedId = redisTemplate.opsForValue().get(IDEMPOTENCY_PREFIX + idempotencyKey);
            if (cachedId != null) {
                return eyeExamRepository.findById(cachedId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.CONFLICT, "Idempotency key reused but original record not found"));
            }
        }

        EyeExam exam = EyeExam.builder()
                .patientId(request.getPatientId())
                .recordId(request.getRecordId())
                .organizationId(organizationId)
                .facilityId(request.getFacilityId())
                .examDate(request.getExamDate())
                .eyeSide(request.getEyeSide())
                .rightEye(toMeasurement(request.getRightEye()))
                .leftEye(toMeasurement(request.getLeftEye()))
                .teleOphthalmologyReview(Boolean.TRUE.equals(request.getTeleOphthalmologyReview()))
                .reviewingSpecialistId(request.getReviewingSpecialistId())
                // PHI-bearing free-text fields go through encryption before persistence
                .reviewingSpecialistNotes(phiCryptoService.encrypt(request.getReviewingSpecialistNotes()))
                .fundusPhotographyAttachmentIds(request.getFundusPhotographyAttachmentIds())
                .clinicalNotes(phiCryptoService.encrypt(request.getClinicalNotes()))
                .examinedBy(currentUserId)
                .examinedByName(currentUserName)
                .status(EyeExam.ExamStatus.COMPLETED)
                .build();

        EyeExam saved;
        try {
            saved = eyeExamRepository.save(exam);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate eye exam submission");
        }

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            redisTemplate.opsForValue().set(IDEMPOTENCY_PREFIX + idempotencyKey, saved.getId(), IDEMPOTENCY_TTL);
        }

        return decryptForResponse(saved);
    }

    public EyeExam getById(String id) {
        EyeExam exam = eyeExamRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Eye exam not found: " + id));
        return decryptForResponse(exam);
    }

    public List<EyeExam> getByPatient(String patientId) {
        return eyeExamRepository.findByPatientIdOrderByExamDateDesc(patientId)
                .stream().map(this::decryptForResponse).toList();
    }

    public Page<EyeExam> getByOrganization(String organizationId, Pageable pageable) {
        return eyeExamRepository.findByOrganizationId(organizationId, pageable)
                .map(this::decryptForResponse);
    }

    /** Tele-ophthalmology worklist: exams flagged for review but not yet actioned. */
    public List<EyeExam> getPendingTeleReview() {
        return eyeExamRepository.findByTeleOphthalmologyReviewTrueAndReviewingSpecialistIdIsNull()
                .stream().map(this::decryptForResponse).toList();
    }

    @Transactional
    public EyeExam completeTeleReview(String examId, String specialistId, String notes) {
        EyeExam exam = eyeExamRepository.findById(examId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Eye exam not found"));

        exam.setReviewingSpecialistId(specialistId);
        exam.setReviewingSpecialistNotes(phiCryptoService.encrypt(notes));
        exam.setUpdatedAt(LocalDateTime.now());

        return decryptForResponse(eyeExamRepository.save(exam));
    }

    private EyeExam.EyeMeasurement toMeasurement(EyeExamRequest.EyeMeasurementDto dto) {
        if (dto == null) return null;
        return EyeExam.EyeMeasurement.builder()
                .visualAcuity(dto.getVisualAcuity())
                .visualAcuityNotation(dto.getVisualAcuityNotation())
                .intraocularPressure(dto.getIntraocularPressure())
                .octResult(dto.getOctResult())
                .iolMasterResult(dto.getIolMasterResult())
                .keratometryResult(dto.getKeratometryResult())
                .pachymetryResult(dto.getPachymetryResult())
                .visualFieldResult(dto.getVisualFieldResult())
                .retinalExamNotes(dto.getRetinalExamNotes())
                .retinalInjectionGiven(dto.getRetinalInjectionGiven())
                .build();
    }

    // Decrypt PHI fields only at the point of returning to an authorized caller
    private EyeExam decryptForResponse(EyeExam exam) {
        EyeExam copy = exam.toBuilder().build();
        copy.setClinicalNotes(phiCryptoService.decrypt(exam.getClinicalNotes()));
        copy.setReviewingSpecialistNotes(phiCryptoService.decrypt(exam.getReviewingSpecialistNotes()));
        return copy;
    }
}
