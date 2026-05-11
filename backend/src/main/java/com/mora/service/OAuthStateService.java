package com.mora.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class OAuthStateService {

    private final SecretKey key;

    public OAuthStateService(@Value("${app.jwt-secret}") String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET must be configured");
        }

        byte[] keyBytes = new byte[32];
        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        System.arraycopy(secretBytes, 0, keyBytes, 0, Math.min(secretBytes.length, 32));
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    public String createState(String provider) {
        return Jwts.builder()
                .subject("oauth_state")
                .claim("provider", provider)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + (1000L * 60L * 10L)))
                .signWith(key)
                .compact();
    }

    public boolean isValid(String provider, String state) {
        if (provider == null || provider.isBlank() || state == null || state.isBlank()) {
            return false;
        }

        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(state)
                    .getPayload();
            return "oauth_state".equals(claims.getSubject()) && provider.equals(claims.get("provider", String.class));
        } catch (Exception e) {
            return false;
        }
    }
}
