package com.healthcare.epcr.feedback.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.feedback.model.FeedbackThread;
import com.healthcare.epcr.feedback.repository.FeedbackRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.service.NotificationService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.model.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final PatientCareRecordRepository patientCareRecordRepository;
    private final AccessControlService accessControlService;
    private final NotificationService notificationService;

    public FeedbackThread createFeedbackThread(FeedbackThread thread) {
        PatientCareRecord record = null;
        if (thread.getPatientCareRecordId() != null) {
            record = patientCareRecordRepository.findById(thread.getPatientCareRecordId())
                    .orElseThrow(() -> new ResourceNotFoundException("Patient care record not found: " + thread.getPatientCareRecordId()));
            accessControlService.assertOrganizationAccess(record.getOrganizationId());
            thread.setOrganizationId(record.getOrganizationId());
        }
        thread.setCreatedAt(LocalDateTime.now());
        thread.setUpdatedAt(LocalDateTime.now());
        if (thread.getStatus() == null) {
            thread.setStatus("OPEN");
        }
        
        // Populate initiatedBy securely from the currently logged in user
        User currentUser = accessControlService.currentUser();
        if (currentUser != null) {
            thread.setInitiatedBy(currentUser.getId());
        }
        
        FeedbackThread saved = feedbackRepository.save(thread);
        notifyRecordOwnerOnThreadCreated(saved, record);
        return saved;
    }

    public Optional<FeedbackThread> getFeedbackThreadById(String id) {
        return feedbackRepository.findById(id)
                .filter(thread -> accessControlService.canAccessOrganization(thread.getOrganizationId()));
    }

    public List<FeedbackThread> getAllFeedbackThreads() {
        return feedbackRepository.findAll().stream()
                .filter(thread -> accessControlService.canAccessOrganization(thread.getOrganizationId()))
                .toList();
    }

    public List<FeedbackThread> getFeedbackThreadsByRecord(String patientCareRecordId) {
        return feedbackRepository.findByPatientCareRecordId(patientCareRecordId).stream()
                .filter(thread -> accessControlService.canAccessOrganization(thread.getOrganizationId()))
                .toList();
    }

    public List<FeedbackThread> getFeedbackThreadsByUser(String userId) {
        return feedbackRepository.findByInitiatedBy(userId).stream()
                .filter(thread -> accessControlService.canAccessOrganization(thread.getOrganizationId()))
                .toList();
    }

    public List<FeedbackThread> getOpenFeedbackThreads() {
        return feedbackRepository.findByStatus("OPEN").stream()
                .filter(thread -> accessControlService.canAccessOrganization(thread.getOrganizationId()))
                .toList();
    }

    public FeedbackThread addMessageToThread(String id, FeedbackThread.FeedbackMessage message) {
        FeedbackThread thread = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback thread not found with id: " + id));
        accessControlService.assertOrganizationAccess(thread.getOrganizationId());
        if (isThreadClosed(thread)) {
            throw new IllegalArgumentException("Feedback thread is closed: " + id);
        }

        if (message.getMessageId() == null || message.getMessageId().isBlank()) {
            message.setMessageId(UUID.randomUUID().toString());
        }
        if (message.getTimestamp() == null) {
            message.setTimestamp(LocalDateTime.now());
        }

        // Securely populate sender information from user session
        User currentUser = accessControlService.currentUser();
        message.setSenderId(currentUser.getId());

        String formattedRole = formatRole(currentUser.getRole());
        String fullName = (currentUser.getFirstName() + " " + (currentUser.getLastName() != null ? currentUser.getLastName() : "")).trim();
        if (fullName.isEmpty()) {
            fullName = currentUser.getEmail() != null ? currentUser.getEmail().split("@")[0] : "User";
        }
        message.setSenderName(formattedRole + ": " + fullName);

        if (thread.getMessages() == null) {
            thread.setMessages(new java.util.ArrayList<>());
        }
        thread.getMessages().add(message);
        thread.setUpdatedAt(LocalDateTime.now());
        FeedbackThread saved = feedbackRepository.save(thread);
        notifyOtherParticipantOnMessage(saved, message);
        return saved;
    }

    public FeedbackThread updateThreadStatus(String id, String status) {
        FeedbackThread thread = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback thread not found with id: " + id));
        accessControlService.assertOrganizationAccess(thread.getOrganizationId());

        thread.setStatus(status);
        thread.setUpdatedAt(LocalDateTime.now());
        if ("RESOLVED".equalsIgnoreCase(status) || "CLOSED".equalsIgnoreCase(status)) {
            thread.setResolvedAt(LocalDateTime.now());
        } else {
            thread.setResolvedAt(null);
        }
        return feedbackRepository.save(thread);
    }

    public void deleteFeedbackThread(String id) {
        if (!feedbackRepository.existsById(id)) {
            throw new ResourceNotFoundException("Feedback thread not found with id: " + id);
        }
        FeedbackThread thread = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback thread not found with id: " + id));
        accessControlService.assertOrganizationAccess(thread.getOrganizationId());
        feedbackRepository.deleteById(id);
    }

    public Optional<String> resolveMessageRecipient(FeedbackThread thread, FeedbackThread.FeedbackMessage message) {
        if (thread == null || message == null || message.getSenderId() == null || message.getSenderId().isBlank()) {
            return Optional.empty();
        }

        String recipientId = null;
        if (thread.getInitiatedBy() != null && !thread.getInitiatedBy().equals(message.getSenderId())) {
            recipientId = thread.getInitiatedBy();
        } else {
            recipientId = resolveRecordOwnerId(thread).orElse(null);
        }

        if (recipientId == null || recipientId.isBlank() || recipientId.equals(message.getSenderId())) {
            return Optional.empty();
        }
        return Optional.of(recipientId);
    }

    private void notifyRecordOwnerOnThreadCreated(FeedbackThread thread, PatientCareRecord record) {
        String recipientId = resolveRecordOwnerId(record).orElse(null);
        if (recipientId == null || recipientId.isBlank() || recipientId.equals(thread.getInitiatedBy())) {
            return;
        }

        Notification notification = new Notification();
        notification.setRecipientId(recipientId);
        notification.setType("INFO");
        notification.setTitle("New Feedback Thread");
        notification.setMessage("Feedback started on record " + recordLabel(record) + ": " + thread.getSubject());
        notification.setRelatedEntityId(thread.getId());
        notification.setRelatedEntityType("FeedbackThread");
        notificationService.createNotification(notification);
    }

    private void notifyOtherParticipantOnMessage(FeedbackThread thread, FeedbackThread.FeedbackMessage message) {
        resolveMessageRecipient(thread, message).ifPresent(recipientId -> {
            Notification notification = new Notification();
            notification.setRecipientId(recipientId);
            notification.setType("INFO");
            notification.setTitle("New Feedback Message");
            notification.setMessage(message.getSenderName() + " replied in: " + thread.getSubject());
            notification.setRelatedEntityId(thread.getId());
            notification.setRelatedEntityType("FeedbackThread");
            notificationService.createNotification(notification);
        });
    }

    private Optional<String> resolveRecordOwnerId(FeedbackThread thread) {
        if (thread.getPatientCareRecordId() == null || thread.getPatientCareRecordId().isBlank()) {
            return Optional.empty();
        }
        return patientCareRecordRepository.findById(thread.getPatientCareRecordId())
                .flatMap(this::resolveRecordOwnerId);
    }

    private Optional<String> resolveRecordOwnerId(PatientCareRecord record) {
        if (record == null) {
            return Optional.empty();
        }
        if (record.getSubmittedBy() != null && !record.getSubmittedBy().isBlank()) {
            return Optional.of(record.getSubmittedBy());
        }
        if (record.getParamedicsId() != null && !record.getParamedicsId().isBlank()) {
            return Optional.of(record.getParamedicsId());
        }
        return Optional.empty();
    }

    private boolean isThreadClosed(FeedbackThread thread) {
        return "RESOLVED".equalsIgnoreCase(thread.getStatus()) || "CLOSED".equalsIgnoreCase(thread.getStatus());
    }

    private String recordLabel(PatientCareRecord record) {
        if (record == null) {
            return "unknown";
        }
        if (record.getIncidentNumber() != null && !record.getIncidentNumber().isBlank()) {
            return record.getIncidentNumber();
        }
        return record.getId();
    }

    private String formatRole(Role role) {
        if (role == null) return "User";
        switch (role) {
            case ADMIN: return "Admin";
            case MANAGER: return "Manager";
            case PARAMEDIC: return "Paramedic";
            case PHYSICIAN: return "Physician";
            case QA_REVIEWER: return "QA Reviewer";
            case VIEWER: return "Viewer";
            case PATIENT: return "Patient";
            default: return role.name();
        }
    }
}
