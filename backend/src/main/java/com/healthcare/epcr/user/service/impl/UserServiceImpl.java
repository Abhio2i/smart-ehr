package com.healthcare.epcr.user.service.impl;

import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.healthcare.epcr.user.dto.UserDTO;
import com.healthcare.epcr.user.dto.CreateUserRequest;
import com.healthcare.epcr.user.dto.UpdateUserRequest;
import com.healthcare.epcr.user.service.IUserService;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl implements IUserService {
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessControlService accessControlService;

    @Override
    public UserDTO createUser(CreateUserRequest request) {
        log.info("Creating user with email: {}", request.getEmail());
        try {
            if (request.getEmail() != null && userRepository.findByEmail(request.getEmail()).isPresent()) {
                log.warn("User already exists with email: {}", request.getEmail());
                throw new IllegalArgumentException("User already exists with email: " + request.getEmail());
            }
            if (request.getPhone() != null && userRepository.findByPhone(request.getPhone()).isPresent()) {
                log.warn("User already exists with phone: {}", request.getPhone());
                throw new IllegalArgumentException("User already exists with phone: " + request.getPhone());
            }
            if (request.getOrganizationId() == null || request.getOrganizationId().isBlank()) {
                String defaultOrgId = accessControlService.currentUser() != null ? accessControlService.currentUser().getOrganizationId() : null;
                if (defaultOrgId != null && !defaultOrgId.isBlank()) {
                    request.setOrganizationId(defaultOrgId);
                    log.info("Auto-assigned organizationId {} from authenticated user profile", defaultOrgId);
                } else {
                    log.error("Organization ID is required for user creation");
                    throw new IllegalArgumentException("organizationId is required");
                }
            }
            if (!organizationRepository.existsById(request.getOrganizationId())) {
                log.error("Organization not found with id: {}", request.getOrganizationId());
                throw new IllegalArgumentException("Organization not found with id: " + request.getOrganizationId());
            }
            accessControlService.assertOrganizationAccess(request.getOrganizationId());
            if (request.getRole() == Role.ADMIN && accessControlService.currentUser().getRole() != Role.ADMIN) {
                log.warn("Non-admin user attempted to create ADMIN role account");
                throw new IllegalArgumentException("Only ADMIN can create users with ADMIN role");
            }
            if (request.getPassword() == null || request.getPassword().length() < 8) {
                log.warn("Invalid password provided for user: {}", request.getEmail());
                throw new IllegalArgumentException("Password must be at least 8 characters");
            }

            User user = new User();
            user.setFirstName(request.getFirstName());
            user.setLastName(request.getLastName());
            user.setEmail(request.getEmail());
            user.setPhone(request.getPhone());
            user.setOrganizationId(request.getOrganizationId());
            user.setRole(request.getRole());
            if (request.getSpecialty() != null && !request.getSpecialty().isBlank()) {
                if (request.getRole() != Role.PHYSICIAN) {
                    throw new IllegalArgumentException("Clinical specialty can only be assigned to PHYSICIAN role");
                }
                user.setSpecialty(request.getSpecialty());
            } else {
                user.setSpecialty(null);
            }
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
            user.setCreatedAt(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            user.setActive(true);
            user.setEmailVerified(false);

            User savedUser = userRepository.save(user);
            log.info("User created successfully with id: {} and email: {}", savedUser.getId(), savedUser.getEmail());
            return mapToDTO(savedUser);
        } catch (Exception e) {
            log.error("Error creating user with email: {}", request.getEmail(), e);
            throw e;
        }
    }

    @Override
    public Optional<UserDTO> getUserById(String id) {
        log.debug("Fetching user with id: {}", id);
        return userRepository.findById(id)
                .filter(user -> {
                    boolean canAccess = accessControlService.canAccessOrganization(user.getOrganizationId());
                    if (!canAccess) {
                        log.warn("Access denied to user: {}", id);
                    }
                    return canAccess;
                })
                .map(this::mapToDTO);
    }

    @Override
    public Optional<UserDTO> getUserByEmail(String email) {
        log.debug("Fetching user by email: {}", email);
        return userRepository.findByEmail(email)
                .filter(user -> accessControlService.canAccessOrganization(user.getOrganizationId()))
                .map(this::mapToDTO);
    }

    @Override
    public Page<UserDTO> getUsersByOrganization(String organizationId, Pageable pageable) {
        log.debug("Fetching users for organization: {} with pagination", organizationId);
        accessControlService.assertOrganizationAccess(organizationId);
        return userRepository.findByOrganizationId(organizationId, pageable)
                .map(this::mapToDTO);
    }

    @Override
    public List<UserDTO> getUsersByRole(Role role) {
        log.debug("Fetching users with role: {}", role);
        return userRepository.findByRole(role)
                .stream()
                .filter(user -> accessControlService.canAccessOrganization(user.getOrganizationId()))
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<UserDTO> searchSpecialists(String query, String organizationId) {
        log.debug("Searching specialists with query: {} and org: {}", query, organizationId);
        String currentOrg = (organizationId != null && !organizationId.isBlank()) 
                ? organizationId 
                : accessControlService.currentUser().getOrganizationId();

        List<User> users;
        if (currentOrg != null && !currentOrg.isBlank()) {
            users = userRepository.findByOrganizationId(currentOrg);
        } else {
            users = userRepository.findAll();
        }

        String q = (query != null) ? query.toLowerCase().trim() : "";

        return users.stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .filter(u -> {
                    if (q.isEmpty()) return true;
                    String fullName = ((u.getFirstName() != null ? u.getFirstName() : "") + " " + (u.getLastName() != null ? u.getLastName() : "")).toLowerCase();
                    String email = (u.getEmail() != null) ? u.getEmail().toLowerCase() : "";
                    String id = (u.getId() != null) ? u.getId().toLowerCase() : "";
                    String role = (u.getRole() != null) ? u.getRole().name().toLowerCase() : "";
                    return fullName.contains(q) || email.contains(q) || id.contains(q) || role.contains(q);
                })
                .map(this::mapToDTO)
                .limit(50)
                .collect(Collectors.toList());
    }

    @Override
    public UserDTO updateUser(String id, UpdateUserRequest request) {
        log.info("Updating user with id: {}", id);
        try {
            User user = userRepository.findById(id)
                    .orElseThrow(() -> {
                        log.error("User not found with id: {}", id);
                        return new ResourceNotFoundException("User not found with id: " + id);
                    });
            accessControlService.assertOrganizationAccess(user.getOrganizationId());

            if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
            if (request.getLastName() != null) user.setLastName(request.getLastName());
            if (request.getPhone() != null) {
                Optional<User> phoneOwner = userRepository.findByPhone(request.getPhone());
                if (phoneOwner.isPresent() && !phoneOwner.get().getId().equals(id)) {
                    log.warn("Phone already in use: {}", request.getPhone());
                    throw new IllegalArgumentException("User already exists with phone: " + request.getPhone());
                }
                user.setPhone(request.getPhone());
            }
            if (request.getRole() != null) {
                if (request.getRole() == Role.ADMIN && accessControlService.currentUser().getRole() != Role.ADMIN) {
                    log.warn("Non-admin user attempted to assign ADMIN role");
                    throw new IllegalArgumentException("Only ADMIN can assign ADMIN role");
                }
                user.setRole(request.getRole());
            }
            if (request.getSpecialty() != null && !request.getSpecialty().isBlank()) {
                Role targetRole = user.getRole();
                if (targetRole != Role.PHYSICIAN) {
                    throw new IllegalArgumentException("Clinical specialty can only be assigned to PHYSICIAN role");
                }
                user.setSpecialty(request.getSpecialty());
            } else if (request.getRole() != null && request.getRole() != Role.PHYSICIAN) {
                user.setSpecialty(null);
            }
            if (request.getActive() != null) user.setActive(request.getActive());

            user.setUpdatedAt(LocalDateTime.now());
            User updatedUser = userRepository.save(user);
            log.info("User updated successfully with id: {}", id);
            return mapToDTO(updatedUser);
        } catch (Exception e) {
            log.error("Error updating user with id: {}", id, e);
            throw e;
        }
    }

    @Override
    public void deleteUser(String id) {
        log.info("Deleting user with id: {}", id);
        try {
            User existing = userRepository.findById(id)
                    .orElseThrow(() -> {
                        log.error("User not found for deletion: {}", id);
                        return new ResourceNotFoundException("User not found with id: " + id);
                    });
            accessControlService.assertOrganizationAccess(existing.getOrganizationId());
            userRepository.deleteById(id);
            log.info("User deleted successfully with id: {}", id);
        } catch (Exception e) {
            log.error("Error deleting user with id: {}", id, e);
            throw e;
        }
    }

    @Override
    public Page<UserDTO> getAllUsers(Pageable pageable) {
        log.debug("Fetching all users with pagination: page={}, size={}", pageable.getPageNumber(), pageable.getPageSize());
        Page<User> usersPage = userRepository.findAll(pageable);
        List<UserDTO> visibleUsers = new ArrayList<>();
        for (User user : usersPage.getContent()) {
            if (accessControlService.canAccessOrganization(user.getOrganizationId())) {
                visibleUsers.add(mapToDTO(user));
            }
        }
        log.debug("Retrieved {} users", visibleUsers.size());
        return new PageImpl<>(visibleUsers, pageable, usersPage.getTotalElements());
    }

    @Override
    public void updateLastLogin(String userId) {
        log.debug("Updating last login for user: {}", userId);
        Optional<User> user = userRepository.findById(userId);
        if (user.isPresent()) {
            user.get().setLastLogin(LocalDateTime.now());
            userRepository.save(user.get());
            log.debug("Last login updated for user: {}", userId);
        }
    }

    @Override
    public void updateSignaturePin(String userId, com.healthcare.epcr.user.dto.UpdateSignaturePinRequest request) {
        log.info("Updating e-signature PIN for user: {}", userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        accessControlService.assertOrganizationAccess(user.getOrganizationId());

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Incorrect login password. Identity verification failed.");
        }

        String newPin = request.getNewPin();
        if (newPin == null || !newPin.matches("^\\d{4}$")) {
            throw new IllegalArgumentException("PIN must be exactly 4 numeric digits.");
        }

        user.setEsignaturePinHash(passwordEncoder.encode(newPin));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        log.info("Successfully updated e-signature PIN hash for user: {}", userId);
    }

    private UserDTO mapToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setOrganizationId(user.getOrganizationId());
        dto.setRole(user.getRole());
        dto.setSpecialty(user.getSpecialty());
        dto.setActive(user.getActive());
        dto.setEmailVerified(user.getEmailVerified());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        dto.setLastLogin(user.getLastLogin());
        return dto;
    }
}
