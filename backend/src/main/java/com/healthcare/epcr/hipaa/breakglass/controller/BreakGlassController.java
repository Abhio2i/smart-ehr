package com.healthcare.epcr.hipaa.breakglass.controller;

import com.healthcare.epcr.hipaa.breakglass.model.BreakGlassEvent;
import com.healthcare.epcr.hipaa.breakglass.service.BreakGlassService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/break-glass")
@RequiredArgsConstructor
public class BreakGlassController {
    private final BreakGlassService service;

    @PostMapping("/start")
    @PreAuthorize("hasAnyRole('PHYSICIAN','PARAMEDIC','ADMIN')")
    public ResponseEntity<BreakGlassEvent> start(@RequestBody Map<String, String> body) {
        int ttl = body.get("ttlMinutes") == null ? 30 : Integer.parseInt(body.get("ttlMinutes"));
        return ResponseEntity.ok(service.start(
                body.get("organizationId"),
                body.get("patientId"),
                body.get("justification"),
                ttl
        ));
    }

    @PostMapping("/{eventId}/end")
    @PreAuthorize("hasAnyRole('PHYSICIAN','PARAMEDIC','ADMIN')")
    public ResponseEntity<BreakGlassEvent> end(@PathVariable String eventId) {
        return ResponseEntity.ok(service.end(eventId));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<BreakGlassEvent>> active() {
        return ResponseEntity.ok(service.active());
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<BreakGlassEvent>> history(@RequestParam String organizationId) {
        return ResponseEntity.ok(service.history(organizationId));
    }
}

