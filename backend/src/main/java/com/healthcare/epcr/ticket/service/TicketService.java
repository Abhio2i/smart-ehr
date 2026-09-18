package com.healthcare.epcr.ticket.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.config.SupabaseStorageService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.ticket.model.Ticket;
import com.healthcare.epcr.ticket.repository.TicketRepository;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.model.Role;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketService {
    private final TicketRepository ticketRepository;
    private final SupabaseStorageService supabaseStorageService;
    private final AccessControlService accessControlService;
    private final OrganizationRepository organizationRepository;

    public Ticket createTicket(String subject, String description, String category, String priority, MultipartFile screenshot) {
        User currentUser = accessControlService.currentUser();
        
        Ticket ticket = new Ticket();
        ticket.setSubject(subject);
        ticket.setDescription(description);
        ticket.setCategory(category);
        ticket.setPriority(priority);
        ticket.setStatus("OPEN");
        ticket.setCreatedBy(currentUser.getId());
        ticket.setOrganizationId(currentUser.getOrganizationId());
        ticket.setCreatorEmail(currentUser.getEmail());
        ticket.setCreatorPhone(currentUser.getPhone());
        
        String orgName = "Unknown Organization";
        if (currentUser.getOrganizationId() != null) {
            orgName = organizationRepository.findById(currentUser.getOrganizationId())
                    .map(com.healthcare.epcr.organization.model.Organization::getName)
                    .orElse("Unknown Organization");
        }
        ticket.setOrganizationName(orgName);
        
        String formattedRole = formatRole(currentUser.getRole());
        String fullName = (currentUser.getFirstName() + " " + (currentUser.getLastName() != null ? currentUser.getLastName() : "")).trim();
        if (fullName.isEmpty()) {
            fullName = currentUser.getEmail() != null ? currentUser.getEmail().split("@")[0] : "User";
        }
        ticket.setCreatorName(formattedRole + ": " + fullName);
        
        if (screenshot != null && !screenshot.isEmpty()) {
            // Re-use Supabase S3 storage service. We use "support" as the folder name.
            String objectKey = supabaseStorageService.uploadFile("support", screenshot);
            ticket.setScreenshotKey(objectKey);
        }
        
        ticket.setCreatedAt(LocalDateTime.now());
        ticket.setUpdatedAt(LocalDateTime.now());
        
        Ticket saved = ticketRepository.save(ticket);
        populateScreenshotUrl(saved);
        return saved;
    }

    public List<Ticket> getTicketsForCurrentUser() {
        User currentUser = accessControlService.currentUser();
        List<Ticket> tickets;
        
        if (currentUser.getRole() == Role.ADMIN) {
            tickets = ticketRepository.findAll();
        } else {
            tickets = ticketRepository.findByCreatedBy(currentUser.getId());
        }
        
        tickets.forEach(this::populateScreenshotUrl);
        return tickets;
    }

    public Ticket getTicketById(String id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with id: " + id));
        
        User currentUser = accessControlService.currentUser();
        if (currentUser.getRole() != Role.ADMIN && !ticket.getCreatedBy().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Access denied for ticket id: " + id);
        }
        
        populateScreenshotUrl(ticket);
        return ticket;
    }

    public Ticket updateTicketStatus(String id, String status) {
        User currentUser = accessControlService.currentUser();
        if (currentUser.getRole() != Role.ADMIN) {
            throw new IllegalArgumentException("Only administrators can update ticket status");
        }
        
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with id: " + id));
        
        ticket.setStatus(status.toUpperCase());
        ticket.setUpdatedAt(LocalDateTime.now());
        if ("RESOLVED".equalsIgnoreCase(status) || "CLOSED".equalsIgnoreCase(status)) {
            ticket.setResolvedAt(LocalDateTime.now());
        } else {
            ticket.setResolvedAt(null);
        }
        
        Ticket saved = ticketRepository.save(ticket);
        populateScreenshotUrl(saved);
        return saved;
    }

    private void populateScreenshotUrl(Ticket ticket) {
        if (ticket.getScreenshotKey() != null && !ticket.getScreenshotKey().isBlank()) {
            try {
                String signedUrl = supabaseStorageService.generateSignedUrl(ticket.getScreenshotKey());
                ticket.setScreenshotUrl(signedUrl);
            } catch (Exception e) {
                log.error("Failed to generate signed url for ticket screenshot: {}", ticket.getScreenshotKey(), e);
            }
        }
    }

    private String formatRole(Role role) {
        if (role == null) return "User";
        switch (role) {
            case ADMIN: return "Admin";
            case MANAGER: return "Manager";
            case PARAMEDIC: return "Paramedic";
            case PHYSICIAN: return "Physician";
            case QA_REVIEWER: return "QA Reviewer";
            case VIEWER: return "Viewer";
            case PATIENT: return "Patient";
            default: return role.name();
        }
    }
}
