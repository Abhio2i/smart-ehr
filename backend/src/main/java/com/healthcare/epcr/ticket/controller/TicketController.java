package com.healthcare.epcr.ticket.controller;

import com.healthcare.epcr.ticket.model.Ticket;
import com.healthcare.epcr.ticket.service.TicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {
    private final TicketService ticketService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Ticket> createTicket(
            @RequestParam("subject") String subject,
            @RequestParam("description") String description,
            @RequestParam("category") String category,
            @RequestParam("priority") String priority,
            @RequestParam(value = "screenshot", required = false) MultipartFile screenshot) {
        Ticket ticket = ticketService.createTicket(subject, description, category, priority, screenshot);
        return ResponseEntity.status(HttpStatus.CREATED).body(ticket);
    }

    @GetMapping
    public ResponseEntity<List<Ticket>> getTickets() {
        return ResponseEntity.ok(ticketService.getTicketsForCurrentUser());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Ticket> getTicketById(@PathVariable String id) {
        return ResponseEntity.ok(ticketService.getTicketById(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Ticket> updateTicketStatus(
            @PathVariable String id,
            @RequestParam("status") String status) {
        return ResponseEntity.ok(ticketService.updateTicketStatus(id, status));
    }
}
