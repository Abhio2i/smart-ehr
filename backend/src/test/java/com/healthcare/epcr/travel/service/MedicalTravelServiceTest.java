package com.healthcare.epcr.travel.service;

import com.healthcare.epcr.travel.model.AccommodationBooking;
import com.healthcare.epcr.travel.model.MedicalTravelRequest;
import com.healthcare.epcr.travel.model.TravelVoucher;
import com.healthcare.epcr.travel.repository.AccommodationBookingRepository;
import com.healthcare.epcr.travel.repository.MedicalTravelRequestRepository;
import com.healthcare.epcr.travel.repository.TravelVoucherRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicalTravelServiceTest {

    @Mock
    private MedicalTravelRequestRepository travelRequestRepository;

    @Mock
    private AccommodationBookingRepository accommodationRepository;

    @Mock
    private TravelVoucherRepository voucherRepository;

    @Mock
    private PatientCareRecordRepository epcrRepository;

    @Mock
    private PhiCryptoService phiCryptoService;

    @InjectMocks
    private MedicalTravelService travelService;

    @BeforeEach
    void setUp() {
        lenient().when(phiCryptoService.decrypt(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void createTravelRequestSetsPendingStatusAndSave() {
        // Arrange
        MedicalTravelRequest request = new MedicalTravelRequest();
        request.setPatientId("patient-456");
        request.setSourceFacility("Stanton");
        request.setDestinationFacility("Alberta Health");
        request.setTravelDate(LocalDate.now().plusDays(2));
        request.setTransportType("FLIGHT");

        when(travelRequestRepository.save(any(MedicalTravelRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act
        MedicalTravelRequest result = travelService.createTravelRequest(request);

        // Assert
        assertNotNull(result);
        assertEquals("PENDING", result.getStatus());
        assertEquals("patient-456", result.getPatientId());
        verify(travelRequestRepository, times(1)).save(request);
    }

    @Test
    void createAccommodationBookingAssociatesRequestAndSaves() {
        // Arrange
        String requestId = "req-111";
        MedicalTravelRequest mockRequest = new MedicalTravelRequest();
        mockRequest.setId(requestId);
        mockRequest.setPatientId("patient-456");

        AccommodationBooking booking = new AccommodationBooking();
        booking.setHotelName("Yellowknife Inn");
        booking.setCheckInDate(LocalDate.now());
        booking.setCheckOutDate(LocalDate.now().plusDays(3));

        when(travelRequestRepository.findById(requestId)).thenReturn(Optional.of(mockRequest));
        when(accommodationRepository.save(any(AccommodationBooking.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act
        AccommodationBooking result = travelService.createAccommodationBooking(requestId, booking);

        // Assert
        assertNotNull(result);
        assertEquals(requestId, result.getTravelRequestId());
        assertEquals("patient-456", result.getPatientId());
        assertEquals("BOOKED", result.getStatus());
        verify(accommodationRepository, times(1)).save(booking);
    }

    @Test
    void createTravelVoucherGeneratesVoucherAndSaves() {
        // Arrange
        String requestId = "req-222";
        MedicalTravelRequest mockRequest = new MedicalTravelRequest();
        mockRequest.setId(requestId);
        mockRequest.setPatientId("patient-789");

        when(travelRequestRepository.findById(requestId)).thenReturn(Optional.of(mockRequest));
        when(voucherRepository.save(any(TravelVoucher.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act
        TravelVoucher result = travelService.createTravelVoucher(requestId, 150.50, "Meals and Taxi");

        // Assert
        assertNotNull(result);
        assertEquals(requestId, result.getTravelRequestId());
        assertEquals("patient-789", result.getPatientId());
        assertEquals("SUBMITTED", result.getStatus());
        assertEquals(150.50, result.getAmount());
        assertTrue(result.getVoucherNumber().startsWith("VCH-"));
        verify(voucherRepository, times(1)).save(any(TravelVoucher.class));
    }
}
