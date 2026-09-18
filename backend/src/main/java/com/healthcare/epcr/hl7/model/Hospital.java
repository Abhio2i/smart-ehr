package com.healthcare.epcr.hl7.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "hospitals")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Hospital {
    @Id
    private String id;
    private String name;
    private String hl7Ip;
    private Integer hl7Port;
    private Boolean active;
}
