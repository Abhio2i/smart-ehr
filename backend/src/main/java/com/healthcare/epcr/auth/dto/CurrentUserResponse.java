package com.healthcare.epcr.auth.dto;

import com.healthcare.epcr.user.model.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CurrentUserResponse {
    private String id;
    private String userId;
    private String firstName;
    private String lastName;
    private String email;
    private String organizationId;
    private Role role;
}
