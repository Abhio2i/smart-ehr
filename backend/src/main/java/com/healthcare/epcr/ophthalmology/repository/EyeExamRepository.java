package com.healthcare.epcr.ophthalmology.repository;

import com.healthcare.epcr.ophthalmology.entity.EyeExam;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface EyeExamRepository extends MongoRepository<EyeExam, String> {

    List<EyeExam> findByPatientIdOrderByExamDateDesc(String patientId);

    Page<EyeExam> findByOrganizationId(String organizationId, Pageable pageable);

    Page<EyeExam> findByOrganizationIdAndStatus(
            String organizationId, EyeExam.ExamStatus status, Pageable pageable);

    List<EyeExam> findByTeleOphthalmologyReviewTrueAndReviewingSpecialistIdIsNull();
}
