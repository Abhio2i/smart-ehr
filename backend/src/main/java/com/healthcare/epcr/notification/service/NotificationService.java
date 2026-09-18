package com.healthcare.epcr.notification.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final AccessControlService accessControlService;
    private final UserRepository userRepository;

    public Notification createNotification(Notification notification) {
        validateNotificationPayload(notification);
        assertRecipientAccess(notification.getRecipientId());
        notification.setCreatedAt(LocalDateTime.now());
        if (notification.getRead() == null) {
            notification.setRead(false);
        }
        return notificationRepository.save(notification);
    }

    public Optional<Notification> getNotificationById(String id) {
        return notificationRepository.findById(id)
                .filter(this::canAccessNotification);
    }

    public List<Notification> getAllNotifications() {
        return notificationRepository.findAll().stream()
                .filter(this::canAccessNotification)
                .toList();
    }


    public List<Notification> getMyNotifications() {
        String currentUserId = accessControlService.currentUser().getId();
        return notificationRepository.findByRecipientId(currentUserId).stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();
    }


    public List<Notification> getMyUnreadNotifications() {
        String currentUserId = accessControlService.currentUser().getId();
        return notificationRepository.findByRecipientIdAndRead(currentUserId, false).stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();
    }

    public PageResponse<Notification> getMyNotificationsPaginated(int page, int size) {
        String currentUserId = accessControlService.currentUser().getId();
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        var result = notificationRepository.findByRecipientId(currentUserId, pageable);
        return PageResponse.from(result);
    }

    public PageResponse<Notification> getMyUnreadNotificationsPaginated(int page, int size) {
        String currentUserId = accessControlService.currentUser().getId();
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        var result = notificationRepository.findByRecipientIdAndRead(currentUserId, false, pageable);
        return PageResponse.from(result);
    }

    public Notification markAsRead(String id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + id));
        if (!canAccessNotification(notification)) {
            throw new IllegalArgumentException("Access denied for notification id: " + id);
        }
        notification.setRead(true);
        notification.setReadAt(LocalDateTime.now());
        return notificationRepository.save(notification);
    }


    public void markMyNotificationsAsRead() {
        String currentUserId = accessControlService.currentUser().getId();
        List<Notification> notifications = notificationRepository.findByRecipientIdAndRead(currentUserId, false);
        for (Notification notification : notifications) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());
        }
        notificationRepository.saveAll(notifications);
    }

    public void deleteNotification(String id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + id));
        if (!canAccessNotification(notification)) {
            throw new IllegalArgumentException("Access denied for notification id: " + id);
        }
        notificationRepository.deleteById(id);
    }

    private boolean canAccessNotification(Notification notification) {
        if (notification == null || notification.getRecipientId() == null) {
            return false;
        }
        User currentUser = accessControlService.currentUser();
        if (notification.getRecipientId().equals(currentUser.getId())) {
            return true;
        }
        return userRepository.findById(notification.getRecipientId())
                .map(recipient -> accessControlService.canAccessOrganization(recipient.getOrganizationId()))
                .orElse(false);
    }

    private void assertRecipientAccess(String recipientId) {
        if (recipientId == null || recipientId.isBlank()) {
            throw new IllegalArgumentException("recipientId is required");
        }
        User currentUser = accessControlService.currentUser();
        if (recipientId.equals(currentUser.getId())) {
            return;
        }
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new ResourceNotFoundException("Recipient not found: " + recipientId));
        if (!accessControlService.canAccessOrganization(recipient.getOrganizationId())) {
            throw new IllegalArgumentException("Access denied for recipientId: " + recipientId);
        }
    }

    private void validateNotificationPayload(Notification notification) {
        if (notification == null) {
            throw new IllegalArgumentException("notification payload is required");
        }
        if (notification.getRecipientId() == null || notification.getRecipientId().isBlank()) {
            throw new IllegalArgumentException("recipientId is required");
        }
        if (notification.getTitle() == null || notification.getTitle().isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        if (notification.getMessage() == null || notification.getMessage().isBlank()) {
            throw new IllegalArgumentException("message is required");
        }
        if (notification.getTitle().length() > 160) {
            throw new IllegalArgumentException("title must be <= 160 characters");
        }
    }
}
