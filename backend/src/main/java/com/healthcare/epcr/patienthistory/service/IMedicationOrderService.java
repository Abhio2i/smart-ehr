package com.healthcare.epcr.patienthistory.service;

import com.healthcare.epcr.epcr.dto.MedicationSafetyAlert;
import com.healthcare.epcr.patienthistory.dto.CreateMedicationOrderRequest;
import com.healthcare.epcr.patienthistory.dto.MedicationOrderDTO;

import java.util.List;

public interface IMedicationOrderService {
    List<MedicationOrderDTO> getPatientOrders(String patientId);
    MedicationOrderDTO createOrder(String patientId, CreateMedicationOrderRequest request);
    MedicationOrderDTO discontinueOrder(String patientId, String orderId, String reason);
    List<MedicationSafetyAlert> checkOrderSafety(String patientId, String genericName);
}
