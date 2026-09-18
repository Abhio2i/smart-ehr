package com.healthcare.epcr.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class ClientIpResolver {

    private final Set<String> trustedProxyAddresses;

    public ClientIpResolver(@Value("${security.trusted-proxies:}") String trustedProxies) {
        this.trustedProxyAddresses = Arrays.stream(trustedProxies.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toUnmodifiableSet());
    }

    public String resolve(HttpServletRequest request) {
        if (request == null) {
            return "N/A";
        }

        String remoteAddress = request.getRemoteAddr();
        if (isTrustedProxy(remoteAddress)) {
            String forwardedFor = firstHeaderIp(request.getHeader("X-Forwarded-For"));
            if (forwardedFor != null) {
                return forwardedFor;
            }

            String realIp = firstHeaderIp(request.getHeader("X-Real-IP"));
            if (realIp != null) {
                return realIp;
            }
        }

        return remoteAddress == null || remoteAddress.isBlank() ? "N/A" : remoteAddress;
    }

    private String firstHeaderIp(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            return null;
        }

        String first = headerValue.split(",")[0].trim();
        return first.isBlank() ? null : first;
    }

    private boolean isTrustedProxy(String remoteAddress) {
        if (remoteAddress == null || remoteAddress.isBlank()) {
            return false;
        }
        if (trustedProxyAddresses.contains(remoteAddress)) {
            return true;
        }

        try {
            InetAddress address = InetAddress.getByName(remoteAddress);
            return address.isLoopbackAddress() || address.isSiteLocalAddress();
        } catch (Exception ignored) {
            return false;
        }
    }
}
