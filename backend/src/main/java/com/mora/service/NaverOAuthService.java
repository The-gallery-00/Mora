package com.mora.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mora.dto.oauth.NaverTokenResponse;
import com.mora.dto.oauth.NaverUserResponse;
import com.mora.dto.oauth.OAuthUserResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class NaverOAuthService {

    private final RestTemplate restTemplate;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public NaverOAuthService(RestTemplate restTemplate,
                             @Value("${app.oauth.naver.client-id}") String clientId,
                             @Value("${app.oauth.naver.client-secret}") String clientSecret,
                             @Value("${app.oauth.naver.redirect-uri}") String redirectUri) {
        this.restTemplate = restTemplate;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    public String getAuthorizationUrl(String state) {
        validateOAuthConfig();

        return UriComponentsBuilder.fromHttpUrl("https://nid.naver.com/oauth2.0/authorize")
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .build()
                .toUriString();
    }

    public OAuthUserResponse getUserProfileByCode(String code, String state) {
        validateOAuthConfig();
        if (code == null || code.isBlank()) {
            throw new RuntimeException("Authorization code is required");
        }
        if (state == null || state.isBlank()) {
            throw new RuntimeException("State is required");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("code", code);
        form.add("state", state);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<NaverTokenResponse> tokenResponse = restTemplate.postForEntity(
                "https://nid.naver.com/oauth2.0/token",
                new HttpEntity<>(form, headers),
                NaverTokenResponse.class
        );
        NaverTokenResponse bsTokenResponse = tokenResponse.getBody();
        if (bsTokenResponse == null || bsTokenResponse.getAccessToken() == null || bsTokenResponse.getAccessToken().isBlank()) {
            throw new RuntimeException("Failed to get Naver access token");
        }

        HttpHeaders profileHeaders = new HttpHeaders();
        profileHeaders.setBearerAuth(bsTokenResponse.getAccessToken());

        ResponseEntity<NaverUserResponse> userResponse = restTemplate.exchange(
                "https://openapi.naver.com/v1/nid/me",
                HttpMethod.GET,
                new HttpEntity<>(profileHeaders),
                NaverUserResponse.class
        );
        NaverUserResponse bsUserResponse = userResponse.getBody();
        if (bsUserResponse == null || bsUserResponse.getResponse() == null) {
            throw new RuntimeException("Failed to get Naver user profile");
        }

        JsonNode profile = bsUserResponse.getResponse();
        String providerUserId = getJsonText(profile, "id");
        if (providerUserId == null || providerUserId.isBlank()) {
            throw new RuntimeException("Failed to get Naver user profile");
        }

        return new OAuthUserResponse(
                "naver",
                providerUserId,
                getJsonText(profile, "email"),
                getJsonText(profile, "name"),
                getJsonText(profile, "profile_image")
        );
    }

    private void validateOAuthConfig() {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new RuntimeException("Naver OAuth is not configured");
        }
    }

    private String getJsonText(JsonNode node, String field) {
        if (node == null || node.isNull()) {
            return null;
        }
        JsonNode child = node.get(field);
        return child == null || child.isNull() ? null : child.asText(null);
    }
}
