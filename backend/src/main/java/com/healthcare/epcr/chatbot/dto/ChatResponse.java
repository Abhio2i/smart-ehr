package com.healthcare.epcr.chatbot.dto;

public record ChatResponse(
        String reply,
        String conversationId
) {
}
