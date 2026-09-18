package com.healthcare.epcr.aisuggestion.repository;

import com.healthcare.epcr.aisuggestion.model.AiSuggestion;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AiSuggestionRepository extends MongoRepository<AiSuggestion, String> {
    List<AiSuggestion> findByRecordIdOrderByCreatedAtDesc(String recordId);

    Optional<AiSuggestion> findFirstByRecordIdOrderByCreatedAtDesc(String recordId);

    boolean existsByRecordIdAndCreatedAtAfter(String recordId, LocalDateTime createdAt);
}
