package com.healthcare.epcr.voice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "voice_transcripts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceTranscript {
    @Id
    private String id;
    
    @Indexed
    private String recordId;
    
    @Indexed
    private String paramedicsId;
    
    private String transcript;
    private String extractedJson;
    
    @Indexed
    private LocalDateTime createdAt;
}
