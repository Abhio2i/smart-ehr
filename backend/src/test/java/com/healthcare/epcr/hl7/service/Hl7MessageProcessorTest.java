package com.healthcare.epcr.hl7.service;

import ca.uhn.hl7v2.model.v24.message.ACK;
import ca.uhn.hl7v2.parser.Parser;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.patienthistory.model.PatientLabResult;
import com.healthcare.epcr.patienthistory.model.PatientVital;
import com.healthcare.epcr.patienthistory.repository.PatientLabResultRepository;
import com.healthcare.epcr.patienthistory.repository.PatientMedicationRepository;
import com.healthcare.epcr.patienthistory.repository.PatientVitalRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class Hl7MessageProcessorTest {

    @Mock
    private PatientRepository patientRepository;
    @Mock
    private PhiCryptoService phiCryptoService;
    @Mock
    private PatientVitalRepository patientVitalRepository;
    @Mock
    private PatientMedicationRepository patientMedicationRepository;
    @Mock
    private PatientLabResultRepository patientLabResultRepository;

    @InjectMocks
    private Hl7MessageProcessor hl7MessageProcessor;

    @Test
    void processOruR01ParsesVitalsAndLabResults() throws Exception {
        // Arrange
        String patientId = "PAT123";
        Patient mockPatient = new Patient();
        mockPatient.setPatientId(patientId);
        mockPatient.setOrganizationId("org-default");

        when(patientRepository.findByPatientId(patientId)).thenReturn(Optional.of(mockPatient));
        when(phiCryptoService.encrypt(any())).thenAnswer(invocation -> invocation.getArgument(0));

        // Raw HL7 ORU^R01 message containing both heart rate (vital) and creatinine (lab result)
        String rawHl7 = "MSH|^~\\&|MedEPCR|EMS|||20260702000000||ORU^R01|MSG-001|P|2.4\r" +
                "PID|1||PAT123||Doe^John||19800101|M|||||1234567890\r" +
                "OBR|1|||59408-5^Vital Signs Panel^LN|20260702000000|||||||||||||||||F\r" +
                "OBX|1|NM|8867-4^Heart Rate^LN||72|/min|||||F\r" +
                "OBX|2|NM|2324-2^Creatinine^LN||1.2|mg/dL|0.5-1.2|N|||F";

        // Act
        String ackResponse = hl7MessageProcessor.processMessage(rawHl7);

        // Assert
        assertNotNull(ackResponse);
        assertTrue(ackResponse.contains("MSA|AA|MSG-001") || ackResponse.contains("MSA|AA"));

        // Verify PatientVital was saved
        ArgumentCaptor<PatientVital> vitalCaptor = ArgumentCaptor.forClass(PatientVital.class);
        verify(patientVitalRepository, times(1)).save(vitalCaptor.capture());
        PatientVital savedVital = vitalCaptor.getValue();
        assertEquals(patientId, savedVital.getPatientId());
        assertEquals(72, savedVital.getHeartRate());

        // Verify PatientLabResult was saved
        ArgumentCaptor<PatientLabResult> labCaptor = ArgumentCaptor.forClass(PatientLabResult.class);
        verify(patientLabResultRepository, times(1)).save(labCaptor.capture());
        PatientLabResult savedLab = labCaptor.getValue();
        assertEquals(patientId, savedLab.getPatientId());
        assertEquals("Creatinine", savedLab.getTestName());
        assertEquals("1.2", savedLab.getValue());
        assertEquals("mg/dL", savedLab.getUnit());
        assertEquals("0.5-1.2", savedLab.getNormalRange());
        assertEquals("N", savedLab.getInterpretation());
    }
}
