package com.healthcare.epcr.travel.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.travel.model.AccommodationBooking;
import com.healthcare.epcr.travel.model.MedicalTravelRequest;
import com.healthcare.epcr.travel.model.TravelVoucher;
import com.healthcare.epcr.travel.repository.AccommodationBookingRepository;
import com.healthcare.epcr.travel.repository.MedicalTravelRequestRepository;
import com.healthcare.epcr.travel.repository.TravelVoucherRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MedicalTravelService {

    private final MedicalTravelRequestRepository travelRequestRepository;
    private final AccommodationBookingRepository accommodationRepository;
    private final TravelVoucherRepository voucherRepository;
    private final PatientCareRecordRepository epcrRepository;
    private final PhiCryptoService phiCryptoService;

    // --- Travel Request Operations ---

    private MedicalTravelRequest decryptRequestFields(MedicalTravelRequest req) {
        if (req == null) return null;
        req.setPatientId(phiCryptoService.decrypt(req.getPatientId()));
        req.setPatientName(phiCryptoService.decrypt(req.getPatientName()));
        req.setSourceFacility(phiCryptoService.decrypt(req.getSourceFacility()));
        req.setDestinationFacility(phiCryptoService.decrypt(req.getDestinationFacility()));
        return req;
    }

    private List<MedicalTravelRequest> decryptRequests(List<MedicalTravelRequest> list) {
        if (list == null) return null;
        list.forEach(this::decryptRequestFields);
        return list;
    }

    public MedicalTravelRequest createTravelRequest(MedicalTravelRequest request) {
        request.setStatus("PENDING");
        request.setCreatedAt(LocalDateTime.now());
        request.setUpdatedAt(LocalDateTime.now());
        // Clean any client-supplied input if already prefixed with enc:: (or decrypt before storage to match travel db standard)
        request.setPatientId(phiCryptoService.decrypt(request.getPatientId()));
        request.setPatientName(phiCryptoService.decrypt(request.getPatientName()));
        request.setSourceFacility(phiCryptoService.decrypt(request.getSourceFacility()));
        request.setDestinationFacility(phiCryptoService.decrypt(request.getDestinationFacility()));

        MedicalTravelRequest saved = travelRequestRepository.save(request);
        log.info("Created Medical Travel Request ID: {} for Patient: {}", saved.getId(), saved.getPatientId());
        return decryptRequestFields(saved);
    }

    public List<MedicalTravelRequest> getAllTravelRequests(String patientId) {
        List<MedicalTravelRequest> list;
        if (patientId != null && !patientId.isBlank()) {
            list = travelRequestRepository.findByPatientId(patientId);
        } else {
            list = travelRequestRepository.findAll();
        }
        return decryptRequests(list);
    }

    public Optional<MedicalTravelRequest> getTravelRequestById(String id) {
        return travelRequestRepository.findById(id).map(this::decryptRequestFields);
    }

    public MedicalTravelRequest updateTravelRequestStatus(String id, String status, String flightNumber, LocalDateTime flightTime) {
        MedicalTravelRequest request = travelRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medical travel request not found"));
        request.setStatus(status.toUpperCase());
        if (flightNumber != null) {
            request.setFlightNumber(flightNumber);
        }
        if (flightTime != null) {
            request.setFlightTime(flightTime);
        }
        request.setUpdatedAt(LocalDateTime.now());
        MedicalTravelRequest saved = travelRequestRepository.save(request);
        log.info("Updated Travel Request ID: {} status to {}", id, status);
        return decryptRequestFields(saved);
    }

    // --- Accommodation Booking Operations ---

    public AccommodationBooking createAccommodationBooking(String travelRequestId, AccommodationBooking booking) {
        MedicalTravelRequest request = travelRequestRepository.findById(travelRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Associated travel request not found"));
        
        AccommodationBooking existing = accommodationRepository.findByTravelRequestId(travelRequestId).orElse(null);
        if (existing != null) {
            existing.setHotelName(booking.getHotelName());
            existing.setCheckInDate(booking.getCheckInDate());
            existing.setCheckOutDate(booking.getCheckOutDate());
            existing.setCost(booking.getCost());
            existing.setNotes(booking.getNotes());
            existing.setUpdatedAt(LocalDateTime.now());
            AccommodationBooking saved = accommodationRepository.save(existing);
            log.info("Updated Accommodation Booking ID: {} for Request: {}", saved.getId(), travelRequestId);
            return saved;
        }

        booking.setTravelRequestId(travelRequestId);
        booking.setPatientId(request.getPatientId());
        booking.setStatus("BOOKED");
        booking.setCreatedAt(LocalDateTime.now());
        booking.setUpdatedAt(LocalDateTime.now());
        
        AccommodationBooking saved = accommodationRepository.save(booking);
        log.info("Created Accommodation Booking ID: {} for Request: {}", saved.getId(), travelRequestId);
        return saved;
    }

    public Optional<AccommodationBooking> getAccommodationByTravelRequest(String travelRequestId) {
        return accommodationRepository.findByTravelRequestId(travelRequestId);
    }

    // --- Travel Voucher Operations ---

    public TravelVoucher createTravelVoucher(String travelRequestId, Double amount, String notes) {
        MedicalTravelRequest request = travelRequestRepository.findById(travelRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Associated travel request not found"));

        TravelVoucher existing = voucherRepository.findByTravelRequestId(travelRequestId).orElse(null);
        if (existing != null) {
            existing.setAmount(amount);
            existing.setNotes(notes);
            existing.setUpdatedAt(LocalDateTime.now());
            TravelVoucher saved = voucherRepository.save(existing);
            log.info("Updated Travel Voucher ID: {} for Request: {}", saved.getId(), travelRequestId);
            return saved;
        }

        TravelVoucher voucher = new TravelVoucher();
        voucher.setTravelRequestId(travelRequestId);
        voucher.setPatientId(request.getPatientId());
        voucher.setVoucherNumber("VCH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        voucher.setAmount(amount);
        voucher.setNotes(notes);
        voucher.setStatus("SUBMITTED");
        voucher.setCreatedAt(LocalDateTime.now());
        voucher.setUpdatedAt(LocalDateTime.now());

        TravelVoucher saved = voucherRepository.save(voucher);
        log.info("Generated Travel Voucher: {} for Amount: {}", saved.getVoucherNumber(), amount);
        return saved;
    }

    public TravelVoucher updateVoucherStatus(String voucherId, String status, String approvedBy) {
        TravelVoucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Voucher not found"));
        voucher.setStatus(status.toUpperCase());
        voucher.setApprovedBy(approvedBy);
        voucher.setUpdatedAt(LocalDateTime.now());
        return voucherRepository.save(voucher);
    }

    public List<TravelVoucher> getVouchersByPatient(String patientId) {
        return voucherRepository.findByPatientId(patientId);
    }

    public Optional<TravelVoucher> getVoucherByTravelRequest(String travelRequestId) {
        return voucherRepository.findByTravelRequestId(travelRequestId);
    }

    // --- ePCR Integration Operations ---

    /**
     * Create a MedicalTravelRequest directly from an existing ePCR record.
     * Pulls patientId, patient name, and transport destination from the ePCR.
     */
    public MedicalTravelRequest createTravelRequestFromEpcr(String epcrId, String transportType) {
        return createTravelRequestFromEpcr(epcrId, transportType, null, null, null);
    }

    public MedicalTravelRequest createTravelRequestFromEpcr(
            String epcrId,
            String transportType,
            String sourceFacility,
            String destinationFacility,
            LocalDate travelDate) {
        PatientCareRecord epcr = epcrRepository.findById(epcrId)
                .orElseThrow(() -> new ResourceNotFoundException("ePCR record not found: " + epcrId));

        MedicalTravelRequest request = new MedicalTravelRequest();
        request.setPatientId(phiCryptoService.decrypt(epcr.getPatientId()));
        request.setPatientName(phiCryptoService.decrypt(epcr.getPatientName()));
        request.setOrganizationId(epcr.getOrganizationId());
        request.setEpcrRecordId(epcrId);
        
        request.setSourceFacility(sourceFacility != null && !sourceFacility.isBlank()
                ? sourceFacility
                : (epcr.getIncidentLocation() != null ? phiCryptoService.decrypt(epcr.getIncidentLocation()) : "On-scene"));
        request.setDestinationFacility(destinationFacility != null && !destinationFacility.isBlank()
                ? destinationFacility
                : (epcr.getTransportDestination() != null ? phiCryptoService.decrypt(epcr.getTransportDestination()) : "On-scene"));
        request.setTransportType(transportType != null ? transportType.toUpperCase() : "FLIGHT");
        request.setTravelDate(travelDate != null ? travelDate : (epcr.getIncidentDateTime() != null ? epcr.getIncidentDateTime().toLocalDate() : LocalDate.now()));
        request.setStatus("PENDING");
        request.setCreatedAt(LocalDateTime.now());
        request.setUpdatedAt(LocalDateTime.now());

        MedicalTravelRequest saved = travelRequestRepository.save(request);

        // Back-reference: store travel ID on the ePCR record
        epcr.setTravelRequestId(saved.getId());
        epcrRepository.save(epcr);

        log.info("Created Travel Request {} from ePCR {}", saved.getId(), epcrId);
        return decryptRequestFields(saved);
    }

    /**
     * Link an existing travel request to an existing ePCR (bi-directional).
     */
    public MedicalTravelRequest linkTravelToEpcr(String travelRequestId, String epcrId) {
        MedicalTravelRequest travel = travelRequestRepository.findById(travelRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Travel request not found"));
        PatientCareRecord epcr = epcrRepository.findById(epcrId)
                .orElseThrow(() -> new ResourceNotFoundException("ePCR record not found"));

        travel.setEpcrRecordId(epcrId);
        travel.setUpdatedAt(LocalDateTime.now());
        travelRequestRepository.save(travel);

        epcr.setTravelRequestId(travelRequestId);
        epcrRepository.save(epcr);

        log.info("Linked Travel {} <-> ePCR {}", travelRequestId, epcrId);
        return decryptRequestFields(travel);
    }

    /**
     * Get the travel request linked to a given ePCR record ID.
     */
    public Optional<MedicalTravelRequest> getTravelByEpcrId(String epcrId) {
        return travelRequestRepository.findByEpcrRecordId(epcrId).map(this::decryptRequestFields);
    }

    /**
     * Delete a travel request and clean up linked associations (accommodation, vouchers, and ePCR back-references).
     */
    public void deleteTravelRequest(String id) {
        MedicalTravelRequest request = travelRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medical travel request not found"));

        if (request.getEpcrRecordId() != null) {
            epcrRepository.findById(request.getEpcrRecordId()).ifPresent(epcr -> {
                epcr.setTravelRequestId(null);
                epcrRepository.save(epcr);
            });
        }

        accommodationRepository.findByTravelRequestId(id).ifPresent(accommodationRepository::delete);
        voucherRepository.findByTravelRequestId(id).ifPresent(voucherRepository::delete);

        travelRequestRepository.delete(request);
        log.info("Deleted Medical Travel Request ID: {}", id);
    }
}
