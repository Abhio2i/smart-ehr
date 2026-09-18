package com.healthcare.epcr.followup.repository;

import com.healthcare.epcr.followup.model.FollowUpTask;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface FollowUpTaskRepository extends MongoRepository<FollowUpTask, String> {
    Optional<FollowUpTask> findByRecordId(String recordId);

    boolean existsByRecordId(String recordId);

    List<FollowUpTask> findByDueDateLessThanEqualAndStatusOrderByDueDateAsc(LocalDate dueDate, String status);

    List<FollowUpTask> findByOrganizationIdOrderByDueDateAsc(String organizationId);

    List<FollowUpTask> findByOrganizationIdAndStatusOrderByDueDateAsc(String organizationId, String status);

    Page<FollowUpTask> findByOrganizationId(String organizationId, Pageable pageable);

    Page<FollowUpTask> findByOrganizationIdAndStatus(String organizationId, String status, Pageable pageable);

    Page<FollowUpTask> findByOrganizationIdAndParamedicsId(String organizationId, String paramedicsId, Pageable pageable);

    Page<FollowUpTask> findByOrganizationIdAndParamedicsIdAndStatus(String organizationId, String paramedicsId, String status, Pageable pageable);
}
