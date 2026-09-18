package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Document(collection = "drug_master")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DrugMaster {
    @Id
    private String id;
    private String genericName;
    private List<String> brandNames;
    private String drugClass;
    private List<String> allergyClassKeywords;
}
