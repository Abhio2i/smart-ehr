package com.healthcare.epcr.tb.repository;

import com.healthcare.epcr.tb.model.TbDotLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TbDotLogRepository extends MongoRepository<TbDotLog, String> {
    List<TbDotLog> findByCaseId(String caseId);
    List<TbDotLog> findByCaseIdAndLogDateBetween(String caseId, LocalDate start, LocalDate end);
    Optional<TbDotLog> findByCaseIdAndLogDate(String caseId, LocalDate logDate);
}
