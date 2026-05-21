package com.mora.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mora.dto.oauth.KakaoTokenResponse;
import com.mora.dto.oauth.KakaoUserResponse;
import com.mora.dto.oauth.OAuthUserResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class KakaoOAuthService {

    private final RestTemplate restTemplate;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public KakaoOAuthService(RestTemplate restTemplate,
                             @Value("${app.oauth.kakao.client-id}") String clientId,
                             @Value("${app.oauth.kakao.client-secret}") String clientSecret,
                             @Value("${app.oauth.kakao.redirect-uri}") String redirectUri) {
        this.restTemplate = restTemplate;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    public String getAuthorizationUrl(String state) {
        validateOAuthConfig();

        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl("https://kauth.kakao.com/oauth/authorize")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("state", state);

        return builder.build().toUriString();
    }

    public OAuthUserResponse getUserProfileByCode(String code) {
        validateOAuthConfig();
        if (code == null || code.isBlank()) {
            throw new RuntimeException("Authorization code is required");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", clientId);
        form.add("redirect_uri", redirectUri);
        form.add("code", code);
        if (clientSecret != null && !clientSecret.isBlank()) {
            form.add("client_secret", clientSecret);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<KakaoTokenResponse> tokenResponse = restTemplate.postForEntity(
                "https://kauth.kakao.com/oauth/token",
                new HttpEntity<>(form, headers),
                KakaoTokenResponse.class
        );
        KakaoTokenResponse bsTokenResponse = tokenResponse.getBody();
        if (bsTokenResponse == null || bsTokenResponse.getAccessToken() == null || bsTokenResponse.getAccessToken().isBlank()) {
            throw new RuntimeException("Failed to get Kakao access token");
        }

        HttpHeaders profileHeaders = new HttpHeaders();
        profileHeaders.setBearerAuth(bsTokenResponse.getAccessToken());

        ResponseEntity<KakaoUserResponse> userResponse = restTemplate.exchange(
                "https://kapi.kakao.com/v2/user/me",
                HttpMethod.GET,
                new HttpEntity<>(profileHeaders),
                KakaoUserResponse.class
        );
        KakaoUserResponse bsUserResponse = userResponse.getBody();
        if (bsUserResponse == null || bsUserResponse.getId() == null) {
            throw new RuntimeException("Failed to get Kakao user profile");
        }

        JsonNode kakaoAccount = bsUserResponse.getKakaoAccount();
        JsonNode properties = bsUserResponse.getProperties();
        String email = getJsonText(kakaoAccount, "email");
        if (email == null || email.isBlank()) {
            email = "kakao_" + bsUserResponse.getId() + "@kakao.local";
        }

        String name = getJsonText(getJsonNode(kakaoAccount, "profile"), "nickname");
        if (name == null || name.isBlank()) {
            name = getJsonText(properties, "nickname");
        }
        String picture = getJsonText(getJsonNode(kakaoAccount, "profile"), "profile_image_url");
        if (picture == null || picture.isBlank()) {
            picture = getJsonText(properties, "profile_image");
        }

        return new OAuthUserResponse(
                "kakao",
                String.valueOf(bsUserResponse.getId()),
                email,
                name,
                picture
        );
    }

    private void validateOAuthConfig() {
        if (clientId == null || clientId.isBlank()) {
            throw new RuntimeException("Kakao OAuth is not configured");
        }
    }

    private JsonNode getJsonNode(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode child = node.get(field);
        return child == null || child.isNull() ? null : child;
    }

    private String getJsonText(JsonNode node, String field) {
        JsonNode child = getJsonNode(node, field);
        return child == null ? null : child.asText(null);
    }
}
