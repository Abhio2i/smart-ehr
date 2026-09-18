package com.healthcare.epcr.ticket.repository;

import com.healthcare.epcr.ticket.model.Ticket;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TicketRepository extends MongoRepository<Ticket, String> {
    List<Ticket> findByCreatedBy(String createdBy);
    List<Ticket> findByOrganizationId(String organizationId);
}
