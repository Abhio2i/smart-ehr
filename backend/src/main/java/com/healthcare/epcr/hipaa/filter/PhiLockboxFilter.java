package com.healthcare.epcr.hipaa.filter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthcare.epcr.hipaa.consent.service.LockboxService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * TPH PIM-1.1 — Real-Time PHI Lockbox Enforcement Filter.
 *
 * This filter intercepts all clinical API responses, detects if a {@code patientId}
 * is present in the JSON response body, and strips any PHI fields belonging to
 * categories the patient has locked — unless the current clinician has been
 * explicitly granted override access by the patient (or is ADMIN role).
 *
 * Category → Masked fields mapping:
 * <pre>
 *   HIV_STATUS       → hivStatus, hivDiagnosis, hivResult, hivMedications
 *   MENTAL_HEALTH    → psychiatricHistory, mentalHealthDiagnosis, mentalHealthNotes, mentalHealthMedications
 *   SUBSTANCE_ABUSE  → substanceAbuseHistory, substanceAbuseNotes, addictionTreatment
 *   GENETIC_INFO     → geneticTestResults, geneticRiskFactors
 * </pre>
 *
 * Bypass conditions (data is NOT masked):
 * <ul>
 *   <li>Current user is ADMIN role</li>
 *   <li>Patient has granted explicit override to the current user's ID</li>
 *   <li>Request path is /api/break-glass/** (already protected by Break-Glass audit)</li>
 *   <li>Response is not JSON (e.g., file download)</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PhiLockboxFilter extends OncePerRequestFilter {

    /** Replaced value shown to clinicians when a field is locked */
    private static final String LOCKED_PLACEHOLDER = "[LOCKED]";

    /** Category to field-name mapping. Keys match PatientConsent.lockboxCategories values. */
    private static final Map<String, Set<String>> CATEGORY_FIELDS = Map.of(
            "HIV_STATUS",      Set.of("hivStatus", "hivDiagnosis", "hivResult", "hivMedications"),
            "MENTAL_HEALTH",   Set.of("psychiatricHistory", "mentalHealthDiagnosis",
                                       "mentalHealthNotes", "mentalHealthMedications"),
            "SUBSTANCE_ABUSE", Set.of("substanceAbuseHistory", "substanceAbuseNotes", "addictionTreatment"),
            "GENETIC_INFO",    Set.of("geneticTestResults", "geneticRiskFactors")
    );

    /** Paths that bypass lockbox enforcement entirely */
    private static final List<String> BYPASS_PATHS = List.of(
            "/api/break-glass/",
            "/api/patient/auth/",
            "/api/auth/",
            "/api/patients/",   // lockbox management endpoint itself must not be filtered
            "/v3/api-docs",
            "/swagger-ui"
    );

    // Created directly to avoid Spring Boot 4 / Jackson 3 auto-configuration bean conflict
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final LockboxService lockboxService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Only filter GET responses — data reads are what need masking
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        // Skip lockbox management paths themselves
        if (path.contains("/lockbox")) {
            return true;
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(response);
        filterChain.doFilter(request, responseWrapper);

        String contentType = responseWrapper.getContentType();
        if (contentType == null || !contentType.contains(MediaType.APPLICATION_JSON_VALUE)) {
            responseWrapper.copyBodyToResponse();
            return;
        }

        byte[] rawBody = responseWrapper.getContentAsByteArray();
        if (rawBody.length == 0) {
            responseWrapper.copyBodyToResponse();
            return;
        }

        String bodyStr = new String(rawBody, StandardCharsets.UTF_8);

        try {
            JsonNode root = objectMapper.readTree(bodyStr);
            String patientId = extractPatientId(root, request.getRequestURI());

            if (patientId == null || patientId.isBlank()) {
                // No patient context — pass through unchanged
                writeBody(response, rawBody);
                return;
            }

            // Check if lockbox is active for this patient
            List<String> lockedCategories = lockboxService.getLockboxCategories(patientId);
            if (lockedCategories.isEmpty()) {
                writeBody(response, rawBody);
                return;
            }

            // Check if the current user has override access
            if (lockboxService.currentUserHasLockboxOverride(patientId)) {
                log.debug("Lockbox bypass granted for patient={}", patientId);
                writeBody(response, rawBody);
                return;
            }

            // Apply masking
            JsonNode masked = applyMasking(root, lockedCategories);
            byte[] maskedBody = objectMapper.writeValueAsBytes(masked);

            log.info("Lockbox enforced for patient={}: masked categories={}", patientId, lockedCategories);
            writeBody(response, maskedBody);

        } catch (Exception e) {
            log.warn("PhiLockboxFilter: error processing response body for {}: {}", request.getRequestURI(), e.getMessage());
            writeBody(response, rawBody);
        }
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * Extracts the patientId from the JSON response or request URL path.
     * Handles:
     *  - Top-level objects with "patientId" or "id"
     *  - Spring Data Page wrappers with "content" array
     *  - Plain JSON arrays
     *  - Fallback to URL path pattern /api/patients/{patientId}
     */
    private String extractPatientId(JsonNode root, String requestUri) {
        // 1. Check top-level object
        if (root.isObject()) {
            if (root.hasNonNull("patientId") && root.get("patientId").isTextual()) {
                return root.get("patientId").asText();
            }
            // If response is a Page wrapper, check first item in content array
            if (root.has("content") && root.get("content").isArray() && root.get("content").size() > 0) {
                JsonNode first = root.get("content").get(0);
                if (first.isObject() && first.hasNonNull("patientId") && first.get("patientId").isTextual()) {
                    return first.get("patientId").asText();
                }
            }
            // If path is /api/patients/{id} or /api/admin/patients/{id}, check "id"
            if (requestUri.contains("/api/patients/") || requestUri.contains("/api/admin/patients/")) {
                if (root.hasNonNull("id") && root.get("id").isTextual()) {
                    return root.get("id").asText();
                }
            }
        }

        // 2. Check JSON array
        if (root.isArray() && root.size() > 0) {
            JsonNode first = root.get(0);
            if (first.isObject()) {
                if (first.hasNonNull("patientId") && first.get("patientId").isTextual()) {
                    return first.get("patientId").asText();
                }
                if (first.hasNonNull("id") && first.get("id").isTextual()) {
                    return first.get("id").asText();
                }
            }
        }

        // 3. Fallback: Extract from URL path if matching /api/patients/{patientId}
        if (requestUri != null) {
            java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("/api/(?:patients|admin/patients)/([a-zA-Z0-9_-]+)").matcher(requestUri);
            if (matcher.find()) {
                String candidate = matcher.group(1);
                // Ensure candidate is not a sub-resource word
                if (!Set.of("search", "all", "export", "list").contains(candidate)) {
                    return candidate;
                }
            }
        }

        return null;
    }

    /**
     * Recursively masks all locked PHI fields in the JSON tree.
     */
    private JsonNode applyMasking(JsonNode root, List<String> lockedCategories) {
        // Build the full set of field names to mask
        Set<String> fieldsToMask = new java.util.HashSet<>();
        for (String category : lockedCategories) {
            Set<String> categoryFields = CATEGORY_FIELDS.get(category);
            if (categoryFields != null) {
                fieldsToMask.addAll(categoryFields);
            }
        }

        if (fieldsToMask.isEmpty()) {
            return root;
        }

        if (root.isObject()) {
            return maskObject((ObjectNode) root.deepCopy(), fieldsToMask);
        }
        if (root.isArray()) {
            com.fasterxml.jackson.databind.node.ArrayNode arr = objectMapper.createArrayNode();
            root.forEach(item -> {
                if (item.isObject()) {
                    arr.add(maskObject((ObjectNode) item.deepCopy(), fieldsToMask));
                } else {
                    arr.add(item);
                }
            });
            return arr;
        }
        return root;
    }

    private ObjectNode maskObject(ObjectNode node, Set<String> fieldsToMask) {
        node.fields().forEachRemaining(entry -> {
            String key = entry.getKey();
            JsonNode value = entry.getValue();
            if (fieldsToMask.contains(key)) {
                node.put(key, LOCKED_PLACEHOLDER);
            } else if (value.isObject()) {
                node.set(key, maskObject((ObjectNode) value.deepCopy(), fieldsToMask));
            } else if (value.isArray()) {
                // Also recurse into nested arrays
                com.fasterxml.jackson.databind.node.ArrayNode arr = objectMapper.createArrayNode();
                value.forEach(item -> {
                    if (item.isObject()) {
                        arr.add(maskObject((ObjectNode) item.deepCopy(), fieldsToMask));
                    } else {
                        arr.add(item);
                    }
                });
                node.set(key, arr);
            }
        });
        return node;
    }

    private void writeBody(HttpServletResponse response, byte[] body) throws IOException {
        response.setContentLength(body.length);
        response.getOutputStream().write(body);
    }
}
