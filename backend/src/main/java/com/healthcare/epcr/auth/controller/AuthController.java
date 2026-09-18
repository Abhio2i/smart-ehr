package com.healthcare.epcr.auth.controller;

import com.healthcare.epcr.auth.dto.AuthResponse;
import com.healthcare.epcr.auth.dto.CurrentUserResponse;
import com.healthcare.epcr.auth.dto.LoginResult;
import com.healthcare.epcr.auth.dto.LoginRequest;
import com.healthcare.epcr.auth.service.AuthService;
import com.healthcare.epcr.auth.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class  AuthController {

    private final AuthService authService;
    private final JwtService jwtService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        LoginResult result = authService.login(request, httpRequest);
        return ResponseEntity.ok()
                .header("Set-Cookie", jwtService.generateJwtCookie(result.getAccessToken()).toString())
                .header("Set-Cookie", jwtService.generateRefreshCookie(result.getRefreshToken()).toString())
                .body(result.getAuthResponse());
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest httpRequest) {
        LoginResult result = authService.refreshSession(httpRequest);
        return ResponseEntity.ok()
                .header("Set-Cookie", jwtService.generateJwtCookie(result.getAccessToken()).toString())
                .header("Set-Cookie", jwtService.generateRefreshCookie(result.getRefreshToken()).toString())
                .body(result.getAuthResponse());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        authService.logout(httpRequest);
        return ResponseEntity.noContent()
                .header("Set-Cookie", jwtService.getCleanJwtCookie().toString())
                .header("Set-Cookie", jwtService.getCleanRefreshCookie().toString())
                .build();
    }

    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> me() {
        return ResponseEntity.ok(authService.getCurrentUser());
    }

    // CSRF helper: returns current CSRF token (and causes CookieCsrfTokenRepository to set XSRF-TOKEN cookie)
    @GetMapping("/csrf")
    public ResponseEntity<java.util.Map<String, String>> csrf(org.springframework.security.web.csrf.CsrfToken token) {
        java.util.Map<String, String> body = new java.util.HashMap<>();
        body.put("token", token == null ? "" : token.getToken());
        return ResponseEntity.ok(body);
    }
}
