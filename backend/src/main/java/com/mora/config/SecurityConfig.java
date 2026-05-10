package com.mora.config;

import com.mora.security.JwtFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    public SecurityConfig(JwtFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // CORS 설정: 모든 Origin, 메서드, 헤더를 허용 (credentials는 false)
            .cors(cors -> cors.configurationSource(request -> {
                CorsConfiguration config = new CorsConfiguration();
                config.setAllowedOrigins(List.of("*"));
                config.setAllowedMethods(List.of("*"));
                config.setAllowedHeaders(List.of("*"));
                config.setAllowCredentials(false);
                return config;
            }))
            // REST API이므로 CSRF 보호를 비활성화
            .csrf(AbstractHttpConfigurer::disable)
            // JWT 기반 인증이므로 서버 세션을 생성하지 않음(STATELESS)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // 모든 요청을 허용 — 실제 인증 검증은 각 컨트롤러에서 JWT 토큰으로 수행
            .authorizeHttpRequests(auth -> auth
                .anyRequest().permitAll()
            )
            // JwtFilter를 UsernamePasswordAuthenticationFilter 앞에 추가하여 JWT 인증을 먼저 수행
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // bcrypt 알고리즘으로 비밀번호를 해싱한다 (솔트 자동 생성, 강도 기본값 10)
        return new BCryptPasswordEncoder();
    }
}
