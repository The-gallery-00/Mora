package com.mora.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * OAuthStateService — OAuth state 토큰 생성/검증 서비스
 *
 * OAuth 로그인은 사용자가 직접 `/auth/{provider}/login` 으로 진입한 것인지,
 * 아니면 외부에서 콜백 URL을 임의 호출한 것인지 구분해야 한다.
 * 서버 세션을 두지 않는 현재 프로젝트 구조에서는 state를 서명된 짧은 수명 토큰으로 만들면
 * 기존 JWT 방식과 잘 맞으면서도 CSRF 성격의 위조를 줄일 수 있다.
 */
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
