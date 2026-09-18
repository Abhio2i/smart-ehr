package com.healthcare.epcr.auditlog.repository;

import com.healthcare.epcr.auditlog.model.AuditLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends MongoRepository<AuditLog, String> {
    List<AuditLog> findByUserId(String userId);
    List<AuditLog> findByAction(String action);
    List<AuditLog> findByEntityType(String entityType);
    List<AuditLog> findByEntityId(String entityId);
    List<AuditLog> findByEntityTypeAndEntityId(String entityType, String entityId);
    List<AuditLog> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    Page<AuditLog> findAllBy(Pageable pageable);
}
