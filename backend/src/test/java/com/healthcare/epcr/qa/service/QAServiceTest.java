package com.healthcare.epcr.qa.service;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.followup.service.FollowUpTaskService;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.service.NotificationService;
import com.healthcare.epcr.qa.model.QAReview;
import com.healthcare.epcr.qa.repository.QAFormRepository;
import com.healthcare.epcr.qa.repository.QAReviewRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QAServiceTest {

    @Mock
    private QAFormRepository qaFormRepository;
    @Mock
    private QAReviewRepository qaReviewRepository;
    @Mock
    private PatientCareRecordRepository patientCareRecordRepository;
    @Mock
    private AccessControlService accessControlService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private PhiCryptoService phiCryptoService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FollowUpTaskService followUpTaskService;

    @InjectMocks
    private QAService qaService;

    @Test
    void createQAReviewSetsReviewerIdFromAuthenticatedUser() {
        User currentUser = new User();
        currentUser.setId("user-123");

        PatientCareRecord record = new PatientCareRecord();
        record.setId("rec-1");
        record.setOrganizationId("org-1");

        QAReview input = new QAReview();
        input.setPatientCareRecordId("rec-1");
        input.setReviewerId("wrong-reviewer");

        when(accessControlService.currentUser()).thenReturn(currentUser);
        when(patientCareRecordRepository.findById("rec-1")).thenReturn(Optional.of(record));
        doNothing().when(accessControlService).assertOrganizationAccess("org-1");
        when(qaReviewRepository.save(any(QAReview.class))).thenAnswer(invocation -> invocation.getArgument(0));

        QAReview saved = qaService.createQAReview(input);

        assertEquals("user-123", saved.getReviewerId());
    }

    @Test
    void getQAReviewsByReviewerRejectsOtherUserForNonSystemWideUser() {
        User currentUser = new User();
        currentUser.setId("user-123");

        when(accessControlService.currentUser()).thenReturn(currentUser);
        when(accessControlService.isSystemWideQaUser(currentUser)).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> qaService.getQAReviewsByReviewer("user-456"));
        verify(qaReviewRepository, never()).findByReviewerId(any());
    }

    @Test
    void getQAReviewsByReviewerAllowsOwnUserId() {
        User currentUser = new User();
        currentUser.setId("user-123");

        PatientCareRecord record = new PatientCareRecord();
        record.setId("rec-1");
        record.setOrganizationId("org-1");

        QAReview review = new QAReview();
        review.setId("qa-1");
        review.setReviewerId("user-123");
        review.setPatientCareRecordId("rec-1");

        when(accessControlService.currentUser()).thenReturn(currentUser);
        when(accessControlService.isSystemWideQaUser(currentUser)).thenReturn(false);
        when(qaReviewRepository.findByReviewerId("user-123")).thenReturn(List.of(review));
        when(patientCareRecordRepository.findById("rec-1")).thenReturn(Optional.of(record));
        when(accessControlService.canAccessOrganization("org-1")).thenReturn(true);

        List<QAReview> result = qaService.getQAReviewsByReviewer("user-123");

        assertEquals(1, result.size());
        assertEquals("qa-1", result.get(0).getId());
    }

    @Test
    void completeQAReviewUpdatesLinkedRecordStatusToApprovedWhenPassed() {
        User currentUser = new User();
        currentUser.setId("user-123");

        QAReview existing = new QAReview();
        existing.setId("qa-1");
        existing.setPatientCareRecordId("rec-1");
        existing.setReviewerId("old");
        existing.setStatus("QA_PENDING");

        QAReview input = new QAReview();
        input.setPassed(true);
        input.setScore(95.0);
        input.setFeedback("good");

        PatientCareRecord record = new PatientCareRecord();
        record.setId("rec-1");
        record.setOrganizationId("org-1");
        record.setStatus(RecordStatus.SUBMITTED);
        record.setQaApproved(false);

        when(accessControlService.currentUser()).thenReturn(currentUser);
        when(qaReviewRepository.findById("qa-1")).thenReturn(Optional.of(existing));
        when(patientCareRecordRepository.findById("rec-1")).thenReturn(Optional.of(record));
        when(accessControlService.canAccessOrganization("org-1")).thenReturn(true);
        when(phiCryptoService.decrypt(any())).thenReturn("Jane Patient");
        when(userRepository.existsById("user-123")).thenReturn(true);
        when(qaReviewRepository.save(any(QAReview.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(patientCareRecordRepository.save(any(PatientCareRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        qaService.completeQAReview("qa-1", input);

        ArgumentCaptor<PatientCareRecord> recordCaptor = ArgumentCaptor.forClass(PatientCareRecord.class);
        verify(patientCareRecordRepository).save(recordCaptor.capture());
        verify(followUpTaskService).scheduleIfCritical(any(PatientCareRecord.class));
        PatientCareRecord savedRecord = recordCaptor.getValue();
        assertEquals(RecordStatus.APPROVED, savedRecord.getStatus());
        assertEquals(true, savedRecord.getQaApproved());
        assertEquals("user-123", savedRecord.getQaApprovedBy());
        assertEquals("good", savedRecord.getFeedback());

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationService).createNotification(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertEquals("user-123", notification.getRecipientId());
        assertEquals("SUCCESS", notification.getType());
        assertEquals("QA Review Passed", notification.getTitle());
        assertEquals("rec-1", notification.getRelatedEntityId());
        assertEquals("PatientCareRecord", notification.getRelatedEntityType());
    }

    @Test
    void getReviewsWithFilterMineCallsGetQAReviewsByReviewer() {
        User currentUser = new User();
        currentUser.setId("user-123");
        when(accessControlService.currentUser()).thenReturn(currentUser);
        when(accessControlService.isSystemWideQaUser(currentUser)).thenReturn(true);
        when(qaReviewRepository.findByReviewerId("user-123")).thenReturn(List.of());

        List<QAReview> result = qaService.getReviews("mine", "user-123");
        verify(qaReviewRepository).findByReviewerId("user-123");
        assertEquals(0, result.size());
    }

    @Test
    void getReviewsWithFilterPendingCallsGetPendingReviews() {
        when(patientCareRecordRepository.findByStatusAndQaApproved(RecordStatus.SUBMITTED, false))
                .thenReturn(List.of());
        when(qaReviewRepository.findAll()).thenReturn(List.of());

        List<QAReview> result = qaService.getReviews("pending", null);
        verify(qaReviewRepository).findAll();
        assertEquals(0, result.size());
    }

    @Test
    void getPendingReviewsFiltersInaccessibleReviews() {
        QAReview accessibleReview = new QAReview();
        accessibleReview.setId("qa-1");
        accessibleReview.setPatientCareRecordId("rec-1");
        accessibleReview.setStatus("QA_PENDING");

        QAReview inaccessibleReview = new QAReview();
        inaccessibleReview.setId("qa-2");
        inaccessibleReview.setPatientCareRecordId("rec-2");
        inaccessibleReview.setStatus("QA_PENDING");

        PatientCareRecord accessibleRecord = new PatientCareRecord();
        accessibleRecord.setId("rec-1");
        accessibleRecord.setOrganizationId("org-1");

        PatientCareRecord inaccessibleRecord = new PatientCareRecord();
        inaccessibleRecord.setId("rec-2");
        inaccessibleRecord.setOrganizationId("org-2");

        when(patientCareRecordRepository.findByStatusAndQaApproved(RecordStatus.SUBMITTED, false))
                .thenReturn(List.of());
        when(qaReviewRepository.findAll()).thenReturn(List.of(accessibleReview, inaccessibleReview));
        when(patientCareRecordRepository.findById("rec-1")).thenReturn(Optional.of(accessibleRecord));
        when(patientCareRecordRepository.findById("rec-2")).thenReturn(Optional.of(inaccessibleRecord));
        when(accessControlService.canAccessOrganization("org-1")).thenReturn(true);
        when(accessControlService.canAccessOrganization("org-2")).thenReturn(false);

        List<QAReview> result = qaService.getPendingReviews();

        assertEquals(1, result.size());
        assertEquals("qa-1", result.get(0).getId());
    }

    @Test
    void getReviewsWithFilterAllCallsGetAllQAReviews() {
        when(patientCareRecordRepository.findByStatusAndQaApproved(RecordStatus.SUBMITTED, false))
                .thenReturn(List.of());
        when(qaReviewRepository.findAll()).thenReturn(List.of());

        List<QAReview> result = qaService.getReviews("all", null);
        verify(qaReviewRepository).findAll();
        assertEquals(0, result.size());
    }
}
