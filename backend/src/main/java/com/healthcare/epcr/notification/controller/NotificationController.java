package com.healthcare.epcr.notification.controller;

import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.service.NotificationService;
import com.healthcare.epcr.common.dto.PageResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @PostMapping
    public ResponseEntity<Notification> createNotification(@RequestBody Notification notification) {
        return ResponseEntity.status(HttpStatus.CREATED).body(notificationService.createNotification(notification));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Notification> getNotificationById(@PathVariable String id) {
        Optional<Notification> notification = notificationService.getNotificationById(id);
        return notification.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<Notification>> getAllNotifications() {
        return ResponseEntity.ok(notificationService.getAllNotifications());
    }


    @GetMapping("/me")
    public ResponseEntity<?> getMyNotifications(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null || size != null) {
            int resolvedPage = page == null ? 0 : Math.max(page, 0);
            int resolvedSize = size == null ? 20 : Math.min(Math.max(size, 1), 200);
            PageResponse<Notification> paged = notificationService.getMyNotificationsPaginated(resolvedPage, resolvedSize);
            return ResponseEntity.ok(paged);
        }
        return ResponseEntity.ok(notificationService.getMyNotifications());
    }


    @GetMapping("/me/unread")
    public ResponseEntity<?> getMyUnreadNotifications(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null || size != null) {
            int resolvedPage = page == null ? 0 : Math.max(page, 0);
            int resolvedSize = size == null ? 20 : Math.min(Math.max(size, 1), 200);
            PageResponse<Notification> paged = notificationService.getMyUnreadNotificationsPaginated(resolvedPage, resolvedSize);
            return ResponseEntity.ok(paged);
        }
        return ResponseEntity.ok(notificationService.getMyUnreadNotifications());
    }

    @PutMapping("/{id}/mark-as-read")
    public ResponseEntity<Notification> markAsRead(@PathVariable String id) {
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }


    @PutMapping("/me/mark-all-as-read")
    public ResponseEntity<Void> markMyNotificationsAsRead() {
        notificationService.markMyNotificationsAsRead();
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable String id) {
        notificationService.deleteNotification(id);
        return ResponseEntity.noContent().build();
    }
}


