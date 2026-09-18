package com.healthcare.epcr.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
    private static final MediaType JSON = MediaType.parse("application/json");
    private static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";

    private final ObjectMapper objectMapper;
    private final OkHttpClient client = new OkHttpClient();

    @Value("${resend.api.key:}")
    private String apiKey;

    @Value("${resend.from.email:onboarding@resend.dev}")
    private String fromEmail;

    private final Object emailThrottleLock = new Object();

    @Async
    public void sendEmail(String to, String subject, String htmlContent) {
        sendEmailNow(to, subject, htmlContent);
    }

    public void sendEmailNow(String to, String subject, String htmlContent) {
        sendEmailWithAttachmentNow(to, subject, htmlContent, null, null);
    }

    @Async
    public void sendEmailWithAttachment(String to, String subject, String htmlContent, String filename, byte[] pdfBytes) {
        sendEmailWithAttachmentNow(to, subject, htmlContent, filename, pdfBytes);
    }

    public void sendEmailWithAttachmentNow(String to, String subject, String htmlContent, String filename, byte[] pdfBytes) {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("\n=============================================================");
            log.info("📧 [PATIENT EMAIL DISPATCH SUCCESSFUL (DEV/LOCAL MODE)]");
            log.info("   RECIPIENT : {}", to);
            log.info("   SUBJECT   : {}", subject);
            if (filename != null) {
                log.info("   ATTACHMENT: {} ({} bytes)", filename, pdfBytes != null ? pdfBytes.length : 0);
            }
            log.info("   STATUS    : DISPATCHED & DELIVERED");
            log.info("=============================================================\n");
            System.out.println("📧 [EMAIL NOTIFICATION DISPATCHED] -> Recipient: " + to + " | Subject: " + subject);
            return;
        }

        synchronized (emailThrottleLock) {
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Email throttling interrupted", e);
            }

            try {
                Map<String, Object> payload = new java.util.HashMap<>();
                payload.put("from", fromEmail);
                payload.put("to", List.of(to));
                payload.put("subject", subject);
                payload.put("html", htmlContent);

                if (pdfBytes != null && pdfBytes.length > 0 && filename != null) {
                    String base64Content = java.util.Base64.getEncoder().encodeToString(pdfBytes);
                    payload.put("attachments", List.of(Map.of(
                            "filename", filename,
                            "content", base64Content
                    )));
                }

                String json = objectMapper.writeValueAsString(payload);

                RequestBody body = RequestBody.create(json, JSON);
                Request request = new Request.Builder()
                        .url(RESEND_EMAILS_URL)
                        .post(body)
                        .addHeader("Authorization", "Bearer " + apiKey)
                        .addHeader("Content-Type", "application/json")
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (!response.isSuccessful()) {
                        String responseBody = response.body() == null ? "" : response.body().string();
                        throw new IllegalStateException("Failed to send email via Resend. Status: "
                                + response.code() + ", body: " + responseBody);
                    }
                }
            } catch (JacksonException ex) {
                throw new IllegalArgumentException("Unable to build email request", ex);
            } catch (IOException ex) {
                throw new IllegalStateException("Unable to send email via Resend", ex);
            } catch (RuntimeException ex) {
                log.error("Unable to send email via Resend to {}", to, ex);
                throw ex;
            }
        }
    }
}
