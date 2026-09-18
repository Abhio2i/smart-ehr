package com.healthcare.epcr.ltc.repository;

import com.healthcare.epcr.ltc.entity.LtcActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LtcActivityLogRepository extends MongoRepository<LtcActivityLog, String> {
    Page<LtcActivityLog> findByResidentIdOrderByLoggedAtDesc(String residentId, Pageable pageable);
}
