package com.healthcare.epcr.tb.repository;

import com.healthcare.epcr.tb.model.TbTstTest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TbTstTestRepository extends MongoRepository<TbTstTest, String> {
    List<TbTstTest> findByContactId(String contactId);
    List<TbTstTest> findByCaseId(String caseId);
    List<TbTstTest> findByContactIdOrderByPlantDateDesc(String contactId);
}
