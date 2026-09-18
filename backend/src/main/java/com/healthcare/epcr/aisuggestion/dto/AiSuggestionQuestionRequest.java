package com.healthcare.epcr.aisuggestion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiSuggestionQuestionRequest(
        @NotBlank
        @Size(max = 1000)
        String question
) {}
