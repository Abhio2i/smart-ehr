package com.healthcare.epcr.notification.service;

import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private AccessControlService accessControlService;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void markAsReadShouldRejectCrossOrgAccess() {
        User current = new User();
        current.setId("user-a");
        current.setOrganizationId("org-a");

        Notification notification = new Notification();
        notification.setId("n-1");
        notification.setRecipientId("user-b");

        User recipient = new User();
        recipient.setId("user-b");
        recipient.setOrganizationId("org-b");

        when(accessControlService.currentUser()).thenReturn(current);
        when(notificationRepository.findById("n-1")).thenReturn(Optional.of(notification));
        when(userRepository.findById("user-b")).thenReturn(Optional.of(recipient));
        when(accessControlService.canAccessOrganization("org-b")).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> notificationService.markAsRead("n-1"));
        verify(notificationRepository, never()).save(notification);
    }


    @Test
    void deleteShouldRejectWhenRecipientMissingOrInaccessible() {
        User current = new User();
        current.setId("user-a");
        current.setOrganizationId("org-a");

        Notification notification = new Notification();
        notification.setId("n-2");
        notification.setRecipientId("user-b");

        when(accessControlService.currentUser()).thenReturn(current);
        when(notificationRepository.findById("n-2")).thenReturn(Optional.of(notification));
        when(userRepository.findById(anyString())).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> notificationService.deleteNotification("n-2"));
        verify(notificationRepository, never()).deleteById("n-2");
    }
}
