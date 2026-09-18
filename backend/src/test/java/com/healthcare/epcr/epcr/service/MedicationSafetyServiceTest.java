package com.healthcare.epcr.epcr.service;

import com.healthcare.epcr.epcr.dto.MedicationSafetyAlert;
import com.healthcare.epcr.epcr.model.DrugInteraction;
import com.healthcare.epcr.epcr.model.DrugMaster;
import com.healthcare.epcr.epcr.model.MedicationAdministered;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.DrugInteractionRepository;
import com.healthcare.epcr.epcr.repository.DrugMasterRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

public class MedicationSafetyServiceTest {

    private MedicationSafetyService safetyService;

    @Mock
    private DrugMasterRepository drugMasterRepository;

    @Mock
    private DrugInteractionRepository drugInteractionRepository;

    private PatientCareRecord record;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        safetyService = new MedicationSafetyService(drugMasterRepository, drugInteractionRepository);
        record = new PatientCareRecord();
    }

    @Test
    public void testCheckSafety_NoAllergiesNoInteractions() {
        MedicationAdministered newMed = new MedicationAdministered();
        newMed.setMedicationName("Ibuprofen");

        // Mock empty repository lookups
        when(drugMasterRepository.findByGenericNameIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(drugMasterRepository.findByBrandName(anyString())).thenReturn(Optional.empty());

        List<MedicationSafetyAlert> alerts = safetyService.checkSafety(record, newMed);
        assertTrue(alerts.isEmpty(), "Expected no warnings for a clean record.");
    }

    @Test
    public void testCheckSafety_DirectAllergyMatch() {
        record.setAllergy("Sulfa Allergy");
        MedicationAdministered newMed = new MedicationAdministered();
        newMed.setMedicationName("Sulfa");

        when(drugMasterRepository.findByGenericNameIgnoreCase("sulfa")).thenReturn(Optional.empty());

        List<MedicationSafetyAlert> alerts = safetyService.checkSafety(record, newMed);
        assertEquals(1, alerts.size());
        assertEquals("HIGH", alerts.get(0).getRiskLevel());
        assertTrue(alerts.get(0).getWarningMessage().contains("documented allergy"));
        assertEquals("Allergy", alerts.get(0).getTriggerField());
    }

    @Test
    public void testCheckSafety_PenicillinClassAllergyMatch() {
        record.setAllergy("Penicillin");
        MedicationAdministered newMed = new MedicationAdministered();
        newMed.setMedicationName("Amoxicillin");

        // Mock Drug Master entry for Amoxicillin
        DrugMaster amox = DrugMaster.builder()
                .genericName("amoxicillin")
                .drugClass("PENICILLIN")
                .allergyClassKeywords(List.of("pcn", "penicillin"))
                .build();
        when(drugMasterRepository.findByGenericNameIgnoreCase("amoxicillin")).thenReturn(Optional.of(amox));

        List<MedicationSafetyAlert> alerts = safetyService.checkSafety(record, newMed);
        assertEquals(1, alerts.size());
        assertEquals("HIGH", alerts.get(0).getRiskLevel());
        assertTrue(alerts.get(0).getWarningMessage().contains("documented allergy"));
        assertEquals("Allergy", alerts.get(0).getTriggerField());
    }

    @Test
    public void testCheckSafety_DrugDrugInteraction_AspirinWarfarin() {
        record.setCurrentMedicines("Warfarin");
        MedicationAdministered newMed = new MedicationAdministered();
        newMed.setMedicationName("Aspirin");

        // Mock Drug Master lookups
        DrugMaster asp = DrugMaster.builder()
                .genericName("aspirin")
                .drugClass("NSAID")
                .build();
        when(drugMasterRepository.findByGenericNameIgnoreCase("aspirin")).thenReturn(Optional.of(asp));

        DrugMaster warf = DrugMaster.builder()
                .genericName("warfarin")
                .drugClass("ANTICOAGULANT")
                .build();
        when(drugMasterRepository.findByGenericNameIgnoreCase("warfarin")).thenReturn(Optional.of(warf));

        // Mock Interaction Rule
        DrugInteraction inter = DrugInteraction.builder()
                .triggerDrugOrClassA("aspirin")
                .triggerDrugOrClassB("warfarin")
                .riskLevel("MEDIUM")
                .warningMessage("Bleeding risk warned.")
                .build();
        when(drugInteractionRepository.findInteractions("aspirin", "warfarin")).thenReturn(List.of(inter));

        List<MedicationSafetyAlert> alerts = safetyService.checkSafety(record, newMed);
        assertEquals(1, alerts.size());
        assertEquals("MEDIUM", alerts.get(0).getRiskLevel());
        assertEquals("Bleeding risk warned.", alerts.get(0).getWarningMessage());
        assertEquals("Drug-Drug Interaction", alerts.get(0).getTriggerField());
    }
}
