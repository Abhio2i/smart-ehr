package com.healthcare.epcr.mentalhealth.repository;

import com.healthcare.epcr.mentalhealth.entity.MentalHealthSessionLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MentalHealthSessionLogRepository extends MongoRepository<MentalHealthSessionLog, String> {
    Page<MentalHealthSessionLog> findByCaseIdOrderByLoggedAtDesc(String caseId, Pageable pageable);
    List<MentalHealthSessionLog> findByCaseIdOrderByLoggedAtDesc(String caseId);
}
