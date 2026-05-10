package com.mora.service;

import com.mora.dto.GoogleTokenResponse;
import com.mora.dto.GoogleUserResponse;
import com.mora.dto.OAuthUserResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * GoogleOAuthService — Google OAuth 연동 서비스
 *
 * provider별로 토큰 교환 URL, 사용자 정보 URL, 응답 JSON 구조가 모두 다르므로
 * 서비스 클래스를 분리해 두면 컨트롤러가 불필요하게 비대해지지 않는다.
 * 또한 Google 특화 로직이 Kakao/Naver 분기와 섞이지 않아 유지보수가 쉬워진다.
 */
@Service
public class GoogleOAuthService {

    private final RestTemplate restTemplate;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public GoogleOAuthService(RestTemplate restTemplate,
                              @Value("${app.oauth.google.client-id}") String clientId,
                              @Value("${app.oauth.google.client-secret}") String clientSecret,
                              @Value("${app.oauth.google.redirect-uri}") String redirectUri) {
        this.restTemplate = restTemplate;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    public String getAuthorizationUrl(String state) {
        validateOAuthConfig();

        return UriComponentsBuilder.fromHttpUrl("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", "openid profile email")
                .queryParam("state", state)
                .build()
                .toUriString();
    }

    public OAuthUserResponse getUserProfileByCode(String code) {
        validateOAuthConfig();
        if (code == null || code.isBlank()) {
            throw new RuntimeException("Authorization code is required");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<GoogleTokenResponse> tokenResponse = restTemplate.postForEntity(
                "https://oauth2.googleapis.com/token",
                new HttpEntity<>(form, headers),
                GoogleTokenResponse.class
        );
        GoogleTokenResponse bsTokenResponse = tokenResponse.getBody();
        if (bsTokenResponse == null || bsTokenResponse.getAccessToken() == null || bsTokenResponse.getAccessToken().isBlank()) {
            throw new RuntimeException("Failed to get Google access token");
        }

        HttpHeaders profileHeaders = new HttpHeaders();
        profileHeaders.setBearerAuth(bsTokenResponse.getAccessToken());
        ResponseEntity<GoogleUserResponse> userResponse = restTemplate.exchange(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                HttpMethod.GET,
                new HttpEntity<>(profileHeaders),
                GoogleUserResponse.class
        );
        GoogleUserResponse bsUserResponse = userResponse.getBody();
        if (bsUserResponse == null || bsUserResponse.getId() == null || bsUserResponse.getId().isBlank()) {
            throw new RuntimeException("Failed to get Google user profile");
        }

        return new OAuthUserResponse(
                "google",
                bsUserResponse.getId(),
                bsUserResponse.getEmail(),
                bsUserResponse.getName(),
                bsUserResponse.getPicture()
        );
    }

    private void validateOAuthConfig() {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new RuntimeException("Google OAuth is not configured");
        }
    }
}
