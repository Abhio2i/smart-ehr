package com.healthcare.epcr.scheduling.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.util.List;

@Data
@Document(collection = "travel_bundles")
public class TravelBundle {
    @Id
    private String id;
    private String patientId;
    private String patientName;
    private String organizationId;
    private String homeFacilityId;      // patient ki home community health centre
    private String destinationFacilityId; // e.g. Stanton Territorial Hospital, Yellowknife
    private LocalDate travelDate;
    private List<String> appointmentIds; // bundled appointments for this specific trip
    private String medicalTravelApprovalRef; // linked medical travel authority code
    private String status; // PLANNED, TRAVELING, COMPLETED
}
