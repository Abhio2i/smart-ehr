package com.healthcare.epcr.surgical.repository;

import com.healthcare.epcr.surgical.model.PreOpChecklist;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PreOpChecklistRepository extends MongoRepository<PreOpChecklist, String> {

    /** One checklist per surgical case (unique index enforced on model). */
    Optional<PreOpChecklist> findBySurgicalCaseId(String surgicalCaseId);

    boolean existsBySurgicalCaseId(String surgicalCaseId);
}
