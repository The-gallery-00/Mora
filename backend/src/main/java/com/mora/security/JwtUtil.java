package com.mora.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expiration;

    public JwtUtil(
            @Value("${app.jwt-secret}") String secret,
            @Value("${app.jwt-expiration}") long expiration) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET must be configured");
        }
        // 키를 최소 32바이트(256bit)로 보장 — HS256 요구사항
        byte[] keyBytes = new byte[32];
        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        System.arraycopy(secretBytes, 0, keyBytes, 0, Math.min(secretBytes.length, 32));
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expiration = expiration;
    }

    public String generateToken(UUID userId, String email) {
        return Jwts.builder()
                .subject(userId.toString())           // sub 클레임: 사용자 식별자
                .claim("email", email)                // 이메일 커스텀 클레임
                .claim("user_id", userId.toString())  // user_id 커스텀 클레임 (명시적)
                .issuedAt(new Date())                 // 토큰 발급 시각
                .expiration(new Date(System.currentTimeMillis() + expiration))  // 만료 시각
                .signWith(key)                        // HMAC-SHA256 서명
                .compact();                           // 최종 JWT 문자열 생성
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)            // 서명 검증에 사용할 키 설정
                .build()
                .parseSignedClaims(token)   // 토큰 파싱 및 서명 검증
                .getPayload();              // Payload(Claims) 추출
    }

    // 토큰에서 사용자 UUID를 추출(user_id 클레임을 우선 확인하고, 없으면 subject에서 가져옴)
     public UUID getUserId(String token) {
        Claims claims = parseToken(token);
        // user_id claim에서 먼저 시도, 없으면 subject
        String uid = claims.get("user_id", String.class);
        if (uid == null) uid = claims.getSubject();
        return UUID.fromString(uid);
    }

    //토큰 유효성 검사.
    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
