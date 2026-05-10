package com.mora.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    // JWT 인증 토큰 — 클라이언트가 Bearer {token} 형태로 전송
    private String token;
    private UUID userId;
    private String email;
    private String name;
}
