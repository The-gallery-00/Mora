package com.mora.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
public class CalendarOAuthStateService {

    private final SecretKey key;

    public CalendarOAuthStateService(@Value("${app.jwt-secret}") String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET must be configured");
        }

        byte[] keyBytes = new byte[32];
        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        System.arraycopy(secretBytes, 0, keyBytes, 0, Math.min(secretBytes.length, 32));
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    public String createState(UUID userId) {
        return Jwts.builder()
                .subject("calendar_oauth_state")
                .claim("user_id", userId.toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + (1000L * 60L * 10L)))
                .signWith(key)
                .compact();
    }

    public UUID getUserId(String state) {
        if (state == null || state.isBlank()) {
            throw new RuntimeException("Calendar OAuth state is required");
        }

        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(state)
                    .getPayload();
            if (!"calendar_oauth_state".equals(claims.getSubject())) {
                throw new RuntimeException("Invalid Calendar OAuth state");
            }
            return UUID.fromString(claims.get("user_id", String.class));
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Invalid Calendar OAuth state");
        }
    }
}
