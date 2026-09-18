package com.healthcare.epcr.voice.repository;

import com.healthcare.epcr.voice.model.VoiceTranscript;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VoiceTranscriptRepository extends MongoRepository<VoiceTranscript, String> {
}
