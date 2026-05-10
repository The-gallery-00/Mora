package com.mora.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        // 모든 Origin 패턴을 허용 (프론트엔드 개발 서버 포함)
        config.setAllowedOriginPatterns(List.of("*"));
        // GET, POST, PUT, DELETE, OPTIONS(Preflight) 메서드 허용
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        // 모든 요청 헤더 허용 (Authorization, Content-Type 등)
        config.setAllowedHeaders(List.of("*"));
        // 쿠키·인증 헤더를 포함한 요청을 허용
        config.setAllowCredentials(true);

        // 모든 경로("/**")에 위 CORS 설정을 적용
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
