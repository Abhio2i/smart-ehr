package com.healthcare.epcr.user.service.impl;

import com.healthcare.epcr.user.dto.CreateUserRequest;
import com.healthcare.epcr.user.dto.UpdateUserRequest;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for UserServiceImpl
 * Tests core business logic and validation rules
 */
@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AccessControlService accessControlService;

    @InjectMocks
    private UserServiceImpl userService;

    private CreateUserRequest validRequest;
    private User mockUser;

    @BeforeEach
    void setUp() {
        validRequest = new CreateUserRequest();
        validRequest.setFirstName("John");
        validRequest.setLastName("Doe");
        validRequest.setEmail("john.doe@example.com");
        validRequest.setPhone("1234567890");
        validRequest.setPassword("SecurePass123!");
        validRequest.setRole(Role.PARAMEDIC);
        validRequest.setOrganizationId("org-123");

        mockUser = new User();
        mockUser.setId("user-123");
        mockUser.setEmail(validRequest.getEmail());
        mockUser.setFirstName("John");
        mockUser.setLastName("Doe");
        mockUser.setOrganizationId("org-123");
    }

    @Test
    void testCreateUserWithValidData_Success() {
        // Arrange
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByPhone(anyString())).thenReturn(Optional.empty());
        when(organizationRepository.existsById(anyString())).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenReturn(mockUser);

        // Act & Assert
        assertDoesNotThrow(() -> userService.createUser(validRequest));
        verify(userRepository).save(any(User.class));
    }

    @Test
    void testCreateUserWithDuplicateEmail_ThrowsException() {
        // Arrange
        when(userRepository.findByEmail(validRequest.getEmail())).thenReturn(Optional.of(mockUser));

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> userService.createUser(validRequest),
                "Should throw exception for duplicate email");
    }

    @Test
    void testCreateUserWithDuplicatePhone_ThrowsException() {
        // Arrange
        when(userRepository.findByEmail(validRequest.getEmail())).thenReturn(Optional.empty());
        when(userRepository.findByPhone(validRequest.getPhone())).thenReturn(Optional.of(mockUser));

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> userService.createUser(validRequest),
                "Should throw exception for duplicate phone");
    }

    @Test
    void testCreateUserWithoutOrganization_ThrowsException() {
        // Arrange
        validRequest.setOrganizationId("");
        when(userRepository.findByEmail(validRequest.getEmail())).thenReturn(Optional.empty());
        when(userRepository.findByPhone(validRequest.getPhone())).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> userService.createUser(validRequest),
                "Should throw exception when organizationId is blank");
    }

    @Test
    void testCreateUserWithInvalidPassword_ThrowsException() {
        // Arrange
        validRequest.setPassword("short");
        when(userRepository.findByEmail(validRequest.getEmail())).thenReturn(Optional.empty());
        when(userRepository.findByPhone(validRequest.getPhone())).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> userService.createUser(validRequest),
                "Should throw exception for password shorter than 8 characters");
    }

    @Test
    void testGetUserById_Success() {
        // Arrange
        when(userRepository.findById("user-123")).thenReturn(Optional.of(mockUser));
        when(accessControlService.canAccessOrganization(mockUser.getOrganizationId())).thenReturn(true);

        // Act
        var result = userService.getUserById("user-123");

        // Assert
        assertTrue(result.isPresent());
        assertEquals("John", result.get().getFirstName());
        verify(userRepository, times(1)).findById("user-123");
    }

    @Test
    void testGetUserById_NotFound() {
        // Arrange
        when(userRepository.findById("non-existent")).thenReturn(Optional.empty());

        // Act
        var result = userService.getUserById("non-existent");

        // Assert
        assertTrue(result.isEmpty());
    }

    @Test
    void testUpdateUser_Success() {
        // Arrange
        UpdateUserRequest updateRequest = new UpdateUserRequest();
        updateRequest.setFirstName("Jane");

        when(userRepository.findById(anyString())).thenReturn(Optional.of(mockUser));
        when(userRepository.save(any(User.class))).thenReturn(mockUser);

        // Act & Assert
        assertDoesNotThrow(() -> userService.updateUser("user-123", updateRequest));
        verify(userRepository).save(any(User.class));
    }

    @Test
    void testUpdateUser_NotFound() {
        // Arrange
        UpdateUserRequest updateRequest = new UpdateUserRequest();
        when(userRepository.findById("non-existent")).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(ResourceNotFoundException.class, () -> userService.updateUser("non-existent", updateRequest),
                "Should throw exception when user not found");
    }

    @Test
    void testDeleteUser_Success() {
        // Arrange
        when(userRepository.findById(anyString())).thenReturn(Optional.of(mockUser));

        // Act & Assert
        assertDoesNotThrow(() -> userService.deleteUser("user-123"));
        verify(userRepository).deleteById(anyString());
    }

    @Test
    void testDeleteUser_NotFound() {
        // Arrange
        when(userRepository.findById("non-existent")).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(ResourceNotFoundException.class, () -> userService.deleteUser("non-existent"),
                "Should throw exception when user not found");
    }
}

