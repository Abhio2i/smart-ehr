package com.healthcare.epcr.cfs.repository;

import com.healthcare.epcr.cfs.entity.ChildPlacement;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChildPlacementRepository extends MongoRepository<ChildPlacement, String> {
    List<ChildPlacement> findByCfsCaseId(String cfsCaseId);
    List<ChildPlacement> findByFosterHomeId(String fosterHomeId);
    List<ChildPlacement> findByStatus(String status);
}
