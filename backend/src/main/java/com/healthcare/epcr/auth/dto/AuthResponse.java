package com.healthcare.epcr.auth.dto;

import com.healthcare.epcr.user.model.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthResponse {
    private String id;
    private String userId;
    private String email;
    private String organizationId;
    private Role role;
    private String token;
    private String accessToken;
    private String refreshToken;
}
