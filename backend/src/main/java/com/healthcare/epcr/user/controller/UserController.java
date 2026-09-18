package com.healthcare.epcr.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import com.healthcare.epcr.user.dto.UserDTO;
import com.healthcare.epcr.user.dto.CreateUserRequest;
import com.healthcare.epcr.user.dto.UpdateUserRequest;
import com.healthcare.epcr.user.service.IUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final IUserService userService;

    @PostMapping
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createUser(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUserById(@PathVariable String id) {
        Optional<UserDTO> user = userService.getUserById(id);
        return user.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<UserDTO> getUserByEmail(@PathVariable String email) {
        Optional<UserDTO> user = userService.getUserByEmail(email);
        return user.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<Page<UserDTO>> getAllUsers (
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        return ResponseEntity.ok(userService.getAllUsers(pageable));
    }

    @GetMapping("/organization/{organizationId}")
    public ResponseEntity<Page<UserDTO>> getUsersByOrganization(
            @PathVariable String organizationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(userService.getUsersByOrganization(organizationId, pageable));
    }

    @GetMapping("/specialists")
    public ResponseEntity<java.util.List<UserDTO>> searchSpecialists(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String organizationId) {
        return ResponseEntity.ok(userService.searchSpecialists(query, organizationId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDTO> updateUser(@PathVariable String id, @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/profile/signature-pin")
    public ResponseEntity<Void> updateSignaturePin(
            @Valid @RequestBody com.healthcare.epcr.user.dto.UpdateSignaturePinRequest request) {
        String loggedInEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        UserDTO currentUser = userService.getUserByEmail(loggedInEmail)
                .orElseThrow(() -> new com.healthcare.epcr.common.exception.ResourceNotFoundException("Authenticated user not found"));
        userService.updateSignaturePin(currentUser.getId(), request);
        return ResponseEntity.ok().build();
    }
}


