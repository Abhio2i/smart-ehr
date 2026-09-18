package com.healthcare.epcr.sharing.controller;

import com.healthcare.epcr.sharing.dto.ShareResponse;
import com.healthcare.epcr.sharing.service.RecordShareService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * External/token-based endpoints for record sharing.
 */
@RestController
@RequestMapping("/api/shares/external")
@RequiredArgsConstructor
public class ExternalShareController {

    private final RecordShareService recordShareService;

    @PostMapping("/{shareId}/verify")
    public Map<String, String> verify(@PathVariable String shareId, @RequestBody Map<String, String> body) {
        String rawToken = body.get("token");
        String scopedJwt = recordShareService.verifyExternalToken(shareId, rawToken);
        return Map.of("accessToken", scopedJwt, "shareId", shareId);
    }

    @GetMapping("/{shareId}")
    public ShareResponse getSharedRecord(@PathVariable String shareId) {
        return recordShareService.getExternalShareBundle(shareId);
    }

    @PostMapping("/{shareId}/respond")
    public ShareResponse respondToShare(@PathVariable String shareId, @RequestBody Map<String, String> body) {
        String notes = body.get("responseNotes");
        return recordShareService.respondToExternalShare(shareId, notes);
    }
}
