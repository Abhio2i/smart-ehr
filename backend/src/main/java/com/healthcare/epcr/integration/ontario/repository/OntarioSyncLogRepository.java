package com.healthcare.epcr.integration.ontario.repository;

import com.healthcare.epcr.integration.ontario.model.OntarioSyncLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OntarioSyncLogRepository extends MongoRepository<OntarioSyncLog, String> {
    Page<OntarioSyncLog> findByOrganizationIdOrderByTimestampDesc(String organizationId, Pageable pageable);
    List<OntarioSyncLog> findTop20ByOrganizationIdOrderByTimestampDesc(String organizationId);
}
