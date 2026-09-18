package com.healthcare.epcr.feedback.controller;

import com.healthcare.epcr.feedback.model.FeedbackThread;
import com.healthcare.epcr.feedback.service.FeedbackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Slf4j
@Controller
@RequiredArgsConstructor
public class FeedbackWebSocketController {

    private final FeedbackService feedbackService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/feedback/{threadId}/send")
    public void sendMessage(
            @DestinationVariable String threadId,
            @Payload FeedbackThread.FeedbackMessage message,
            Principal principal) {

        try {
            FeedbackThread updatedThread = feedbackService.addMessageToThread(threadId, message);

            messagingTemplate.convertAndSend(
                    "/topic/feedback/" + threadId,
                    updatedThread
            );

            notifyOtherPersonInRealTime(updatedThread, message);
        } catch (Exception e) {
            log.error("WebSocket message failed for thread: {}", threadId, e);
            if (principal != null) {
                messagingTemplate.convertAndSendToUser(
                        principal.getName(),
                        "/queue/errors",
                        "Failed to send feedback message"
                );
            }
        }
    }

    @MessageMapping("/feedback/{threadId}/typing")
    public void typingIndicator(
            @DestinationVariable String threadId,
            @Payload String senderName) {

        messagingTemplate.convertAndSend(
                "/topic/feedback/" + threadId + "/typing",
                senderName + " is typing..."
        );
    }

    private void notifyOtherPersonInRealTime(
            FeedbackThread thread,
            FeedbackThread.FeedbackMessage message) {

        try {
            feedbackService.resolveMessageRecipient(thread, message)
                    .ifPresent(recipientId -> messagingTemplate.convertAndSendToUser(
                            recipientId,
                            "/queue/notifications",
                            "New message in: " + thread.getSubject()
                    ));
        } catch (Exception e) {
            log.warn("Failed to notify other person in thread: {}", thread.getId(), e);
        }
    }
}
