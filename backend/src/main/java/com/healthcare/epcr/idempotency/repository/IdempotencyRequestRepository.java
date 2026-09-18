package com.healthcare.epcr.idempotency.repository;

import com.healthcare.epcr.idempotency.model.IdempotencyRequest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IdempotencyRequestRepository extends MongoRepository<IdempotencyRequest, String> {
}
