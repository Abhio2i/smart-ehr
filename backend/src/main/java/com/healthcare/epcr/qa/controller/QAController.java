package com.healthcare.epcr.qa.controller;

import com.healthcare.epcr.qa.model.QAForm;
import com.healthcare.epcr.qa.model.QAReview;
import com.healthcare.epcr.qa.dto.QAReviewDTO;
import com.healthcare.epcr.qa.service.QAService;
import com.healthcare.epcr.common.dto.PageResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/qa")
@RequiredArgsConstructor
public class QAController {
    private final QAService qaService;

    // QA Form Endpoints
    @PostMapping("/forms")
    public ResponseEntity<QAForm> createQAForm(@RequestBody QAForm form) {
        return ResponseEntity.status(HttpStatus.CREATED).body(qaService.createQAForm(form));
    }

    @GetMapping("/forms/{id}")
    public ResponseEntity<QAForm> getQAFormById(@PathVariable String id) {
        Optional<QAForm> form = qaService.getQAFormById(id);
        return form.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/forms/organization/{organizationId}")
    public ResponseEntity<List<QAForm>> getQAFormsByOrganization(@PathVariable String organizationId) {
        return ResponseEntity.ok(qaService.getQAFormsByOrganization(organizationId));
    }

    @PutMapping("/forms/{id}")
    public ResponseEntity<QAForm> updateQAForm(@PathVariable String id, @RequestBody QAForm form) {
        return ResponseEntity.ok(qaService.updateQAForm(id, form));
    }

    // QA Review Endpoints
    @PostMapping("/reviews")
    public ResponseEntity<QAReviewDTO> createQAReview(@RequestBody QAReview review) {
        QAReview created = qaService.createQAReview(review);
        return ResponseEntity.status(HttpStatus.CREATED).body(qaService.mapToDTO(created));
    }

    @GetMapping("/reviews/stats")
    public ResponseEntity<java.util.Map<String, Long>> getReviewStats() {
        return ResponseEntity.ok(qaService.getReviewStats());
    }

    @GetMapping("/reviews/reviewer/{reviewerId}")
    public ResponseEntity<?> getQAReviewsByReviewer(
            @PathVariable String reviewerId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null || size != null) {
            int resolvedPage = page == null ? 0 : Math.max(page, 0);
            int resolvedSize = size == null ? 20 : Math.min(Math.max(size, 1), 200);
            return ResponseEntity.ok(qaService.getReviewsByReviewerPaginated(reviewerId, resolvedPage, resolvedSize));
        }
        return ResponseEntity.ok(qaService.mapToDTOList(qaService.getQAReviewsByReviewer(reviewerId)));
    }

    @GetMapping("/reviews/pending")
    public ResponseEntity<?> getPendingReviews(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null || size != null) {
            int resolvedPage = page == null ? 0 : Math.max(page, 0);
            int resolvedSize = size == null ? 20 : Math.min(Math.max(size, 1), 200);
            return ResponseEntity.ok(qaService.getPendingReviewsPaginated(resolvedPage, resolvedSize));
        }
        return ResponseEntity.ok(qaService.mapToDTOList(qaService.getPendingReviews()));
    }

    @GetMapping("/reviews/{id}")
    public ResponseEntity<QAReviewDTO> getQAReviewById(@PathVariable String id) {
        Optional<QAReview> review = qaService.getQAReviewById(id);
        return review.map(qaService::mapToDTO).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/reviews")
    public ResponseEntity<PageResponse<QAReviewDTO>> getReviews(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String reviewerId,
            @RequestParam(required = false) String organizationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection) {
        int resolvedPage = page == null ? 0 : Math.max(page, 0);
        int resolvedSize = size == null ? 20 : Math.min(Math.max(size, 1), 200);
        return ResponseEntity.ok(qaService.searchReviews(
                filter,
                status,
                query,
                reviewerId,
                organizationId,
                fromDate,
                toDate,
                resolvedPage,
                resolvedSize,
                sortBy,
                sortDirection
        ));
    }

    @GetMapping("/reviews/record/{patientCareRecordId}")
    public ResponseEntity<List<QAReviewDTO>> getQAReviewsByRecord(@PathVariable String patientCareRecordId) {
        return ResponseEntity.ok(qaService.mapToDTOList(qaService.getQAReviewsByRecord(patientCareRecordId)));
    }

    @PutMapping("/reviews/{id}/complete")
    public ResponseEntity<QAReviewDTO> completeQAReview(@PathVariable String id, @RequestBody QAReview review) {
        QAReview completed = qaService.completeQAReview(id, review);
        return ResponseEntity.ok(qaService.mapToDTO(completed));
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<Void> deleteQAReview(@PathVariable String id) {
        qaService.deleteQAReview(id);
        return ResponseEntity.noContent().build();
    }
}


