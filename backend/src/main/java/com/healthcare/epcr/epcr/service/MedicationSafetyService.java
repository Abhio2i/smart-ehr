package com.healthcare.epcr.epcr.service;

import com.healthcare.epcr.epcr.dto.MedicationSafetyAlert;
import com.healthcare.epcr.epcr.model.DrugInteraction;
import com.healthcare.epcr.epcr.model.DrugMaster;
import com.healthcare.epcr.epcr.model.MedicationAdministered;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.DrugInteractionRepository;
import com.healthcare.epcr.epcr.repository.DrugMasterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MedicationSafetyService {

    private final DrugMasterRepository drugMasterRepository;
    private final DrugInteractionRepository drugInteractionRepository;

    public List<MedicationSafetyAlert> checkSafety(PatientCareRecord record, MedicationAdministered newMed) {
        List<MedicationSafetyAlert> alerts = new ArrayList<>();

        if (newMed == null || newMed.getMedicationName() == null || newMed.getMedicationName().isBlank()) {
            return alerts;
        }

        String targetDrug = newMed.getMedicationName().trim().toLowerCase();

        // Step 1: Resolve administered drug from Drug Master
        Optional<DrugMaster> targetDrugDefOpt = drugMasterRepository.findByGenericNameIgnoreCase(targetDrug);
        if (targetDrugDefOpt.isEmpty()) {
            targetDrugDefOpt = drugMasterRepository.findByBrandName(targetDrug);
        }

        // Step 2: Perform Allergy Checks
        if (record.getAllergy() != null && !record.getAllergy().isBlank()) {
            String allergyText = record.getAllergy().toLowerCase();

            boolean allergyMatched = false;

            // Direct fallback matches
            if (allergyText.contains(targetDrug)) {
                allergyMatched = true;
            }

            // DB-driven allergy check
            if (targetDrugDefOpt.isPresent()) {
                DrugMaster def = targetDrugDefOpt.get();

                // Check generic name
                if (def.getGenericName() != null && allergyText.contains(def.getGenericName().toLowerCase())) {
                    allergyMatched = true;
                }
                // Check brand names
                if (def.getBrandNames() != null) {
                    for (String brand : def.getBrandNames()) {
                        if (allergyText.contains(brand.toLowerCase())) {
                            allergyMatched = true;
                            break;
                        }
                    }
                }
                // Check drug class
                if (def.getDrugClass() != null && allergyText.contains(def.getDrugClass().toLowerCase())) {
                    allergyMatched = true;
                }
                // Check class keywords (e.g. "pcn" for penicillin)
                if (def.getAllergyClassKeywords() != null) {
                    for (String kw : def.getAllergyClassKeywords()) {
                        if (allergyText.contains(kw.toLowerCase())) {
                            allergyMatched = true;
                            break;
                        }
                    }
                }
            }

            if (allergyMatched) {
                alerts.add(MedicationSafetyAlert.builder()
                        .riskLevel("HIGH")
                        .warningMessage("Critical Warning: Patient has a documented allergy to '" + record.getAllergy() + "'. Do not administer " + newMed.getMedicationName() + ".")
                        .triggerField("Allergy")
                        .build());
            }
        }

        // Step 3: Perform Drug-Drug / Drug-Class Interaction Checks
        List<String> activeMedsList = new ArrayList<>();
        if (record.getCurrentMedicines() != null && !record.getCurrentMedicines().isBlank()) {
            String[] activeMeds = record.getCurrentMedicines().toLowerCase().split("[,;\\s]|\\band\\b");
            for (String med : activeMeds) {
                String trimmed = med.trim();
                if (!trimmed.isEmpty() && trimmed.length() >= 3) {
                    activeMedsList.add(trimmed);
                }
            }
        }
        if (record.getStructuredMedications() != null) {
            for (MedicationAdministered med : record.getStructuredMedications()) {
                if (med.getMedicationName() != null && !med.getMedicationName().isBlank()) {
                    String trimmed = med.getMedicationName().trim().toLowerCase();
                    if (!trimmed.isEmpty() && trimmed.length() >= 3 && !activeMedsList.contains(trimmed)) {
                        activeMedsList.add(trimmed);
                    }
                }
            }
        }

        for (String activeDrugName : activeMedsList) {
            // Resolve the active drug from Drug Master to get its class
            Optional<DrugMaster> activeDrugDefOpt = drugMasterRepository.findByGenericNameIgnoreCase(activeDrugName);
            if (activeDrugDefOpt.isEmpty()) {
                activeDrugDefOpt = drugMasterRepository.findByBrandName(activeDrugName);
            }

            // Gather terms for query comparison (resolved to generic names if present in Drug Master)
            String drugA = targetDrugDefOpt.map(DrugMaster::getGenericName).orElse(targetDrug);
            String classA = targetDrugDefOpt.map(DrugMaster::getDrugClass).orElse("UNKNOWN");

            String drugB = activeDrugDefOpt.map(DrugMaster::getGenericName).orElse(activeDrugName);
            String classB = activeDrugDefOpt.map(DrugMaster::getDrugClass).orElse("UNKNOWN");

            // Check DB for any matching interactions between drugA/classA and drugB/classB
            List<DrugInteraction> interactions = new ArrayList<>();
            
            // 1. Direct drug-drug match
            interactions.addAll(drugInteractionRepository.findInteractions(drugA, drugB));
            
            // 2. Class-drug match
            if (!classA.equals("UNKNOWN")) {
                interactions.addAll(drugInteractionRepository.findInteractions(classA, drugB));
            }
            
            // 3. Drug-class match
            if (!classB.equals("UNKNOWN")) {
                interactions.addAll(drugInteractionRepository.findInteractions(drugA, classB));
            }

            // 4. Class-class match
            if (!classA.equals("UNKNOWN") && !classB.equals("UNKNOWN")) {
                interactions.addAll(drugInteractionRepository.findInteractions(classA, classB));
            }

            // Add matched alerts
            for (DrugInteraction inter : interactions) {
                boolean isDuplicate = false;
                for (MedicationSafetyAlert alert : alerts) {
                    if (alert.getWarningMessage().equals(inter.getWarningMessage())) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    alerts.add(MedicationSafetyAlert.builder()
                            .riskLevel(inter.getRiskLevel())
                            .warningMessage(inter.getWarningMessage())
                            .triggerField("Drug-Drug Interaction")
                            .build());
                }
            }
        }

        return alerts;
    }

    public List<MedicationSafetyAlert> checkSafetyManual(String allergyText, List<String> activeMedsList, String targetDrug) {
        List<MedicationSafetyAlert> alerts = new ArrayList<>();
        if (targetDrug == null || targetDrug.isBlank()) {
            return alerts;
        }

        String cleanTarget = targetDrug.trim().toLowerCase();
        Optional<DrugMaster> targetDrugDefOpt = drugMasterRepository.findByGenericNameIgnoreCase(cleanTarget);
        if (targetDrugDefOpt.isEmpty()) {
            targetDrugDefOpt = drugMasterRepository.findByBrandName(cleanTarget);
        }

        // Step 1: Perform Allergy Checks
        if (allergyText != null && !allergyText.isBlank()) {
            String allergyTextLower = allergyText.toLowerCase();
            boolean allergyMatched = false;

            if (allergyTextLower.contains(cleanTarget)) {
                allergyMatched = true;
            }

            if (targetDrugDefOpt.isPresent()) {
                DrugMaster def = targetDrugDefOpt.get();
                if (def.getGenericName() != null && allergyTextLower.contains(def.getGenericName().toLowerCase())) {
                    allergyMatched = true;
                }
                if (def.getBrandNames() != null) {
                    for (String brand : def.getBrandNames()) {
                        if (allergyTextLower.contains(brand.toLowerCase())) {
                            allergyMatched = true;
                            break;
                        }
                    }
                }
                if (def.getDrugClass() != null && allergyTextLower.contains(def.getDrugClass().toLowerCase())) {
                    allergyMatched = true;
                }
                if (def.getAllergyClassKeywords() != null) {
                    for (String kw : def.getAllergyClassKeywords()) {
                        if (allergyTextLower.contains(kw.toLowerCase())) {
                            allergyMatched = true;
                            break;
                        }
                    }
                }
            }

            if (allergyMatched) {
                alerts.add(MedicationSafetyAlert.builder()
                        .riskLevel("HIGH")
                        .warningMessage("Critical Warning: Patient has a documented allergy to '" + allergyText + "'. Do not prescribe " + targetDrug + ".")
                        .triggerField("Allergy")
                        .build());
            }
        }

        // Step 2: Perform Drug-Drug / Drug-Class Interaction Checks
        for (String activeDrugName : activeMedsList) {
            if (activeDrugName == null || activeDrugName.isBlank()) continue;
            String cleanActive = activeDrugName.trim().toLowerCase();

            Optional<DrugMaster> activeDrugDefOpt = drugMasterRepository.findByGenericNameIgnoreCase(cleanActive);
            if (activeDrugDefOpt.isEmpty()) {
                activeDrugDefOpt = drugMasterRepository.findByBrandName(cleanActive);
            }

            String drugA = targetDrugDefOpt.map(DrugMaster::getGenericName).orElse(cleanTarget);
            String classA = targetDrugDefOpt.map(DrugMaster::getDrugClass).orElse("UNKNOWN");

            String drugB = activeDrugDefOpt.map(DrugMaster::getGenericName).orElse(cleanActive);
            String classB = activeDrugDefOpt.map(DrugMaster::getDrugClass).orElse("UNKNOWN");

            List<DrugInteraction> interactions = new ArrayList<>();
            interactions.addAll(drugInteractionRepository.findInteractions(drugA, drugB));
            if (!classA.equals("UNKNOWN")) {
                interactions.addAll(drugInteractionRepository.findInteractions(classA, drugB));
            }
            if (!classB.equals("UNKNOWN")) {
                interactions.addAll(drugInteractionRepository.findInteractions(drugA, classB));
            }
            if (!classA.equals("UNKNOWN") && !classB.equals("UNKNOWN")) {
                interactions.addAll(drugInteractionRepository.findInteractions(classA, classB));
            }

            for (DrugInteraction inter : interactions) {
                boolean isDuplicate = false;
                for (MedicationSafetyAlert alert : alerts) {
                    if (alert.getWarningMessage().equals(inter.getWarningMessage())) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    alerts.add(MedicationSafetyAlert.builder()
                            .riskLevel(inter.getRiskLevel())
                            .warningMessage(inter.getWarningMessage())
                            .triggerField("Drug-Drug Interaction")
                            .build());
                }
            }
        }

        return alerts;
    }
}
