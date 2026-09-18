package com.healthcare.epcr.patient.service;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patient.dto.DuplicateCandidate;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Duplicate Client Detection Service — TPH TB-DQA 1.1
 *
 * Uses a multi-signal scoring algorithm:
 *   1. Soundex phonetic match on patient name
 *   2. Exact DOB match
 *   3. Phone number match
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DuplicateDetectionService {

    private static final int SCORE_THRESHOLD = 2;

    private final PatientCareRecordRepository recordRepository;
    private final PhiCryptoService phiCryptoService;

    public List<DuplicateCandidate> checkDuplicates(String incomingName,
                                                     String incomingDob,
                                                     String incomingPhone,
                                                     String organizationId) {
        if (incomingName == null || incomingName.isBlank()) {
            return Collections.emptyList();
        }

        String incomingSoundex = soundex(incomingName.trim().toLowerCase());
        String incomingDobNorm = incomingDob == null ? "" : incomingDob.trim();
        String incomingPhoneDigits = incomingPhone == null ? "" : incomingPhone.replaceAll("\\D", "");

        List<PatientCareRecord> allRecords = recordRepository.findAll().stream()
                .filter(r -> organizationId == null || organizationId.equals(r.getOrganizationId()))
                .filter(r -> r.getPatientId() != null && r.getPatientName() != null)
                .collect(Collectors.toList());

        Map<String, PatientCareRecord> latestByPatientId = new LinkedHashMap<>();
        for (PatientCareRecord r : allRecords) {
            latestByPatientId.merge(r.getPatientId(), r, (existing, incoming) ->
                    (incoming.getCreatedAt() != null && existing.getCreatedAt() != null
                            && incoming.getCreatedAt().isAfter(existing.getCreatedAt())) ? incoming : existing);
        }

        List<DuplicateCandidate> candidates = new ArrayList<>();

        for (PatientCareRecord record : latestByPatientId.values()) {
            String existingName  = safeDecrypt(record.getPatientName());
            String existingDob   = safeDecrypt(record.getPatientDateOfBirth());
            String existingPhone = record.getPatientPhone() != null
                    ? record.getPatientPhone().replaceAll("\\D", "") : "";

            int score = 0;
            List<String> matchedSignals = new ArrayList<>();

            if (existingName != null && !existingName.isBlank()) {
                String existingSoundex = soundex(existingName.trim().toLowerCase());
                if (incomingSoundex.equals(existingSoundex)) {
                    score += 2;
                    matchedSignals.add("NAME_PHONETIC");
                } else if (levenshteinDistance(incomingName.trim().toLowerCase(),
                        existingName.trim().toLowerCase()) <= 2) {
                    score += 1;
                    matchedSignals.add("NAME_FUZZY");
                }
            }

            if (!incomingDobNorm.isEmpty() && incomingDobNorm.equals(existingDob)) {
                score += 2;
                matchedSignals.add("DOB_EXACT");
            }

            if (!incomingPhoneDigits.isEmpty() && !existingPhone.isEmpty()) {
                String inLast7  = incomingPhoneDigits.length() >= 7
                        ? incomingPhoneDigits.substring(incomingPhoneDigits.length() - 7) : incomingPhoneDigits;
                String exLast7  = existingPhone.length() >= 7
                        ? existingPhone.substring(existingPhone.length() - 7) : existingPhone;
                if (inLast7.equals(exLast7)) {
                    score += 1;
                    matchedSignals.add("PHONE_MATCH");
                }
            }

            if (score >= SCORE_THRESHOLD) {
                double confidence = Math.min(100.0, (score / 5.0) * 100);
                candidates.add(new DuplicateCandidate(
                        record.getPatientId(),
                        record.getId(),
                        existingName,
                        existingDob,
                        record.getPatientPhone(),
                        score,
                        confidence,
                        matchedSignals
                ));
            }
        }

        candidates.sort(Comparator.comparingInt(DuplicateCandidate::getScore).reversed());
        return candidates;
    }

    public static String soundex(String input) {
        if (input == null || input.isBlank()) return "";
        String s = input.toUpperCase().replaceAll("[^A-Z]", "");
        if (s.isEmpty()) return "";

        char[] codes = {'0','1','2','3','0','1','2','0',
                        '0','2','2','4','5','5','0','1',
                        '2','6','2','3','0','1','0','2','0','2'};
        StringBuilder result = new StringBuilder();
        result.append(s.charAt(0));
        char prev = codes[s.charAt(0) - 'A'];

        for (int i = 1; i < s.length() && result.length() < 4; i++) {
            char c = s.charAt(i);
            if (c < 'A' || c > 'Z') continue;
            char code = codes[c - 'A'];
            if (code != '0' && code != prev) {
                result.append(code);
            }
            prev = code;
        }

        while (result.length() < 4) result.append('0');
        return result.toString();
    }

    private static int levenshteinDistance(String a, String b) {
        int m = a.length(), n = b.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (a.charAt(i - 1) == b.charAt(j - 1)) dp[i][j] = dp[i-1][j-1];
                else dp[i][j] = 1 + Math.min(dp[i-1][j-1], Math.min(dp[i-1][j], dp[i][j-1]));
            }
        }
        return dp[m][n];
    }

    private String safeDecrypt(String value) {
        if (value == null || value.isBlank()) return null;
        try { return phiCryptoService.decrypt(value); }
        catch (Exception e) { return value; }
    }
}
