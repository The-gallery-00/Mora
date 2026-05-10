package com.mora.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.UUID;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // Authorization 헤더에서 "Bearer {token}" 형식의 토큰을 추출
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            // "Bearer " 접두사(7자)를 제거하여 순수 토큰 문자열을 얻는다
            String token = header.substring(7);
            if (jwtUtil.isValid(token)) {
                // 토큰에서 사용자 UUID를 추출
                UUID userId = jwtUtil.getUserId(token);
                // Spring Security의 Authentication 객체를 생성 (principal=userId, credentials=null, authorities=빈 목록)
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());
                // SecurityContext에 인증 정보를 설정 → 이후 요청에서 인증된 사용자로 인식
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        // 다음 필터로 요청 전달 (반드시 호출해야 요청이 계속 진행됨)
        filterChain.doFilter(request, response);
    }
}
