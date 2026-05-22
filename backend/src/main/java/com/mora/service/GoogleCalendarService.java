package com.mora.service;

import com.mora.dto.oauth.GoogleTokenResponse;
import com.mora.dto.oauth.GoogleUserResponse;
import com.mora.entity.GoogleCalendarToken;
import com.mora.entity.user.User;
import com.mora.repository.GoogleCalendarTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;

@Service
public class GoogleCalendarService {

    private static final String CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
    private static final String PROFILE_SCOPE = "openid email profile";

    private final RestTemplate restTemplate;
    private final GoogleCalendarTokenRepository tokenRepository;
    private final CalendarOAuthStateService stateService;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public GoogleCalendarService(RestTemplate restTemplate,
                                 GoogleCalendarTokenRepository tokenRepository,
                                 CalendarOAuthStateService stateService,
                                 @Value("${app.calendar.google.client-id}") String clientId,
                                 @Value("${app.calendar.google.client-secret}") String clientSecret,
                                 @Value("${app.calendar.google.redirect-uri}") String redirectUri) {
        this.restTemplate = restTemplate;
        this.tokenRepository = tokenRepository;
        this.stateService = stateService;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    public String getAuthorizationUrl(User user) {
        validateCalendarConfig();

        return UriComponentsBuilder.fromHttpUrl("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", PROFILE_SCOPE + " " + CALENDAR_SCOPE)
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("include_granted_scopes", "true")
                .queryParam("state", stateService.createState(user.getId()))
                .build()
                .toUriString();
    }

    public GoogleCalendarToken connectByCode(String code, String state) {
        validateCalendarConfig();
        if (code == null || code.isBlank()) {
            throw new RuntimeException("Authorization code is required");
        }

        GoogleTokenResponse tokenResponse = requestToken(code);
        if (tokenResponse.getAccessToken() == null || tokenResponse.getAccessToken().isBlank()) {
            throw new RuntimeException("Failed to get Google Calendar access token");
        }

        GoogleUserResponse googleUser = requestGoogleUser(tokenResponse.getAccessToken());
        GoogleCalendarToken token = tokenRepository.findByUserId(stateService.getUserId(state))
                .orElseGet(GoogleCalendarToken::new);

        token.setUserId(stateService.getUserId(state));
        token.setGoogleEmail(googleUser == null ? null : googleUser.getEmail());
        token.setAccessToken(tokenResponse.getAccessToken());
        if (tokenResponse.getRefreshToken() != null && !tokenResponse.getRefreshToken().isBlank()) {
            token.setRefreshToken(tokenResponse.getRefreshToken());
        }
        token.setExpiresAt(toExpiresAt(tokenResponse.getExpiresIn()));
        token.setScope(tokenResponse.getScope());

        return tokenRepository.save(token);
    }

    private GoogleTokenResponse requestToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<GoogleTokenResponse> response = restTemplate.postForEntity(
                "https://oauth2.googleapis.com/token",
                new HttpEntity<>(form, headers),
                GoogleTokenResponse.class
        );
        GoogleTokenResponse body = response.getBody();
        if (body == null) {
            throw new RuntimeException("Failed to get Google Calendar token response");
        }
        return body;
    }

    private GoogleUserResponse requestGoogleUser(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        ResponseEntity<GoogleUserResponse> response = restTemplate.exchange(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                GoogleUserResponse.class
        );
        return response.getBody();
    }

    private LocalDateTime toExpiresAt(Long expiresIn) {
        if (expiresIn == null) {
            return null;
        }
        return LocalDateTime.now().plusSeconds(expiresIn);
    }

    private void validateCalendarConfig() {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new RuntimeException("Google Calendar OAuth is not configured");
        }
    }
}
