package com.healthcare.epcr.travel.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "accommodation_bookings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AccommodationBooking {
    @Id
    private String id;
    
    @Indexed
    private String travelRequestId;
    
    @Indexed
    private String patientId;
    
    private String hotelName;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    
    private String status; // PENDING, BOOKED, CANCELLED
    private Double cost;
    private String notes;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
