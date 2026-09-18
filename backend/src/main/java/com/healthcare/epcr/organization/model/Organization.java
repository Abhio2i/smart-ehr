package com.healthcare.epcr.organization.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.annotation.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Document(collection = "organizations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Organization {
    @Id
    private String id;
    private String name;
    @Indexed(unique = true)
    private String code;
    private String description;
    private String address;
    private String city;
    private String state;
    private String zipCode;
    @Indexed(unique = true, sparse = true)
    private String phone;
    @Indexed(unique = true, sparse = true)
    private String email;
    private String contactPerson;
    private String licenseNumber;
    private Boolean orngeAuthority;
    private Boolean contractedProvider;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}


