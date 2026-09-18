package com.healthcare.epcr.report.service;

import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.qa.model.QAReview;
import com.healthcare.epcr.qa.repository.QAReviewRepository;
import com.healthcare.epcr.security.AccessControlService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    private PatientCareRecordRepository recordRepository;
    @Mock
    private QAReviewRepository qaReviewRepository;
    @Mock
    private AccessControlService accessControlService;

    @InjectMocks
    private ReportService reportService;

    @Test
    void generateCustomReportFiltersByDateRange() {
        LocalDateTime base = LocalDateTime.of(2026, 5, 1, 10, 0);

        PatientCareRecord inRange = new PatientCareRecord();
        inRange.setId("rec-1");
        inRange.setOrganizationId("org-1");
        inRange.setStatus(RecordStatus.SUBMITTED);
        inRange.setCreatedAt(base);

        PatientCareRecord outOfRange = new PatientCareRecord();
        outOfRange.setId("rec-2");
        outOfRange.setOrganizationId("org-1");
        outOfRange.setStatus(RecordStatus.DRAFT);
        outOfRange.setCreatedAt(base.minusDays(10));

        QAReview inRangeReview = new QAReview();
        inRangeReview.setPatientCareRecordId("rec-1");
        inRangeReview.setCreatedAt(base.plusHours(1));
        inRangeReview.setPassed(true);
        inRangeReview.setStatus("QA_COMPLETED");

        QAReview outOfRangeReview = new QAReview();
        outOfRangeReview.setPatientCareRecordId("rec-2");
        outOfRangeReview.setCreatedAt(base.minusDays(10));
        outOfRangeReview.setPassed(false);
        outOfRangeReview.setStatus("QA_COMPLETED");

        when(recordRepository.findAll()).thenReturn(List.of(inRange, outOfRange));
        when(qaReviewRepository.findAll()).thenReturn(List.of(inRangeReview, outOfRangeReview));
        when(accessControlService.canAccessOrganization("org-1")).thenReturn(true);

        Map<String, Object> report = reportService.generateCustomReport(base.minusDays(1), base.plusDays(1));

        @SuppressWarnings("unchecked")
        Map<String, Object> stats = (Map<String, Object>) report.get("statistics");
        @SuppressWarnings("unchecked")
        Map<String, Object> status = (Map<String, Object>) report.get("recordsByStatus");
        @SuppressWarnings("unchecked")
        Map<String, Object> qa = (Map<String, Object>) report.get("qaPerformance");

        assertEquals(1, stats.get("totalRecords"));
        assertEquals(1, stats.get("totalReviews"));
        assertEquals(1L, status.get("submitted"));
        assertEquals(1L, qa.get("passedReviews"));
    }
}

