package com.healthcare.epcr.followup.controller;

import com.healthcare.epcr.common.dto.PageResponse;
import com.healthcare.epcr.followup.dto.FollowUpTaskDTO;
import com.healthcare.epcr.followup.service.FollowUpTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/follow-ups")
@RequiredArgsConstructor
public class FollowUpTaskController {

    private final FollowUpTaskService followUpTaskService;

    @GetMapping
    public ResponseEntity<PageResponse<FollowUpTaskDTO>> listFollowUps(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(followUpTaskService.listVisibleTasks(status, page, size));
    }
}
