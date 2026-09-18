package com.healthcare.epcr.notification.repository;

import com.healthcare.epcr.notification.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends MongoRepository<Notification, String> {
    List<Notification> findByRecipientId(String recipientId);
    List<Notification> findByRecipientIdAndRead(String recipientId, Boolean read);
    List<Notification> findByType(String type);
    Page<Notification> findByRecipientId(String recipientId, Pageable pageable);
    Page<Notification> findByRecipientIdAndRead(String recipientId, Boolean read, Pageable pageable);
    long countByRecipientIdAndRead(String recipientId, Boolean read);
}


