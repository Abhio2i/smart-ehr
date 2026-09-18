package com.healthcare.epcr.aisuggestion.repository;

import com.healthcare.epcr.aisuggestion.model.AiSuggestionQuestionAnswer;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AiSuggestionQuestionAnswerRepository extends MongoRepository<AiSuggestionQuestionAnswer, String> {
    List<AiSuggestionQuestionAnswer> findByRecordIdOrderByCreatedAtDesc(String recordId);
}
