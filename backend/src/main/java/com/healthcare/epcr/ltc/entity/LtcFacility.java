package com.healthcare.epcr.ltc.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ltc_facilities")
public class LtcFacility {
    @Id
    private String id;
    private String organizationId;
    private String name;
    private String community;
    private String region;
    private boolean isPrivate;
    private int bedCapacity;
    private int currentOccupancy;
    private boolean active;
}
