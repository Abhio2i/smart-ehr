package com.healthcare.epcr.user.service;


import com.healthcare.epcr.user.dto.UserDTO;
import com.healthcare.epcr.user.dto.CreateUserRequest;
import com.healthcare.epcr.user.dto.UpdateUserRequest;
import com.healthcare.epcr.user.model.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface IUserService {
    UserDTO createUser(CreateUserRequest request);
    Optional<UserDTO> getUserById(String id);
    Optional<UserDTO> getUserByEmail(String email);
    Page<UserDTO> getUsersByOrganization(String organizationId, Pageable pageable);
    UserDTO updateUser(String id, UpdateUserRequest request);
    void deleteUser(String id);
    Page<UserDTO> getAllUsers(Pageable pageable);
    void updateLastLogin(String userId);
    List<UserDTO> getUsersByRole(Role role);
    List<UserDTO> searchSpecialists(String query, String organizationId);
    void updateSignaturePin(String userId, com.healthcare.epcr.user.dto.UpdateSignaturePinRequest request);
}


