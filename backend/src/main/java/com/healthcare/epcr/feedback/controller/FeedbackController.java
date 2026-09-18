package com.healthcare.epcr.feedback.controller;

import com.healthcare.epcr.feedback.model.FeedbackThread;
import com.healthcare.epcr.feedback.service.FeedbackService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {
    private final FeedbackService feedbackService;

    @PostMapping("/threads")
    public ResponseEntity<FeedbackThread> createFeedbackThread(@RequestBody FeedbackThread thread) {
        return ResponseEntity.status(HttpStatus.CREATED).body(feedbackService.createFeedbackThread(thread));
    }

    @GetMapping("/threads/{id}")
    public ResponseEntity<FeedbackThread> getFeedbackThreadById(@PathVariable String id) {
        Optional<FeedbackThread> thread = feedbackService.getFeedbackThreadById(id);
        return thread.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/threads")
    public ResponseEntity<List<FeedbackThread>> getAllFeedbackThreads() {
        return ResponseEntity.ok(feedbackService.getAllFeedbackThreads());
    }

    @GetMapping("/threads/record/{patientCareRecordId}")
    public ResponseEntity<List<FeedbackThread>> getFeedbackThreadsByRecord(@PathVariable String patientCareRecordId) {
        return ResponseEntity.ok(feedbackService.getFeedbackThreadsByRecord(patientCareRecordId));
    }

    @GetMapping("/threads/user/{userId}")
    public ResponseEntity<List<FeedbackThread>> getFeedbackThreadsByUser(@PathVariable String userId) {
        return ResponseEntity.ok(feedbackService.getFeedbackThreadsByUser(userId));
    }

    @GetMapping("/threads/open")
    public ResponseEntity<List<FeedbackThread>> getOpenFeedbackThreads() {
        return ResponseEntity.ok(feedbackService.getOpenFeedbackThreads());
    }

    @PostMapping("/threads/{id}/messages")
    public ResponseEntity<FeedbackThread> addMessageToThread(@PathVariable String id,
                                                            @RequestBody FeedbackThread.FeedbackMessage message) {
        return ResponseEntity.ok(feedbackService.addMessageToThread(id, message));
    }

    @PutMapping("/threads/{id}/status")
    public ResponseEntity<FeedbackThread> updateThreadStatus(@PathVariable String id,
                                                            @RequestParam String status) {
        return ResponseEntity.ok(feedbackService.updateThreadStatus(id, status));
    }

    @DeleteMapping("/threads/{id}")
    public ResponseEntity<Void> deleteFeedbackThread(@PathVariable String id) {
        feedbackService.deleteFeedbackThread(id);
        return ResponseEntity.noContent().build();
    }
}


