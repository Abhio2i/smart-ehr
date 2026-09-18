package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.DiagnosticCode;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DiagnosticCodeRepository extends MongoRepository<DiagnosticCode, String> {
    Optional<DiagnosticCode> findByCode(String code);
}
