package com.healthcare.epcr.epcr.repository;

import com.healthcare.epcr.epcr.model.DrugInteraction;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DrugInteractionRepository extends MongoRepository<DrugInteraction, String> {

    @Query("{ $or: [ " +
            "  { 'triggerDrugOrClassA': { $regex: ?0, $options: 'i' }, 'triggerDrugOrClassB': { $regex: ?1, $options: 'i' } }, " +
            "  { 'triggerDrugOrClassA': { $regex: ?1, $options: 'i' }, 'triggerDrugOrClassB': { $regex: ?0, $options: 'i' } } " +
            "] }")
    List<DrugInteraction> findInteractions(String drugOrClassA, String drugOrClassB);
}
