package com.mora.service;

import com.mora.dto.oauth.GoogleTokenResponse;
import com.mora.dto.oauth.GoogleUserResponse;
import com.mora.dto.calendar.GoogleCalendarConnectedResponse;
import com.mora.dto.calendar.GoogleCalendarMonthResponse;
import com.mora.dto.calendar.GoogleCalendarTokenResponse;
import com.mora.entity.GoogleCalendarToken;
import com.mora.entity.user.User;
import com.mora.repository.GoogleCalendarTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
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
        if (user == null || user.getId() == null) {
            throw new RuntimeException("사용자 정보가 필요합니다.");
        }

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

    @Transactional
    public GoogleCalendarToken connectByCode(String code, String state) {
        validateCalendarConfig();
        if (code == null || code.isBlank()) {
            throw new RuntimeException("인증 코드가 필요합니다.");
        }

        UUID userId = stateService.getUserId(state);
        GoogleTokenResponse tokenResponse = requestToken(code);
        if (tokenResponse.getAccessToken() == null || tokenResponse.getAccessToken().isBlank()) {
            throw new RuntimeException("구글 캘린더 토큰 발급에 실패했습니다.");
        }

        GoogleUserResponse googleUser = requestGoogleUser(tokenResponse.getAccessToken());
        GoogleCalendarToken token = tokenRepository.findByUserId(userId)
                .orElseGet(GoogleCalendarToken::new);

        token.setUserId(userId);
        token.setGoogleEmail(googleUser == null ? null : googleUser.getEmail());
        token.setAccessToken(tokenResponse.getAccessToken());
        if (tokenResponse.getRefreshToken() != null && !tokenResponse.getRefreshToken().isBlank()) {
            token.setRefreshToken(tokenResponse.getRefreshToken());
        }
        token.setExpiresAt(toExpiresAt(tokenResponse.getExpiresIn()));
        token.setScope(tokenResponse.getScope());

        return tokenRepository.save(token);
    }

    public GoogleCalendarConnectedResponse getConnected(UUID userId) {
        validateUserId(userId);
        return new GoogleCalendarConnectedResponse(userId, tokenRepository.existsByUserId(userId));
    }

    public GoogleCalendarTokenResponse getTokenInfo(UUID userId) {
        validateUserId(userId);
        return tokenRepository.findByUserId(userId)
                .map(GoogleCalendarTokenResponse::from)
                .orElseThrow(() -> new RuntimeException("구글 캘린더 연동 정보가 없습니다."));
    }

    @Transactional
    public GoogleCalendarConnectedResponse disconnect(UUID userId) {
        validateUserId(userId);
        if (!tokenRepository.existsByUserId(userId)) {
            throw new RuntimeException("구글 캘린더 연동 정보가 없습니다.");
        }
        tokenRepository.deleteByUserId(userId);
        return new GoogleCalendarConnectedResponse(userId, false);
    }

    public GoogleCalendarMonthResponse getMonth(UUID userId, int year, int month) {
        validateUserId(userId);
        validateYearMonth(year, month);
        return GoogleCalendarMonthResponse.builder()
                .userId(userId)
                .year(year)
                .month(month)
                .connected(tokenRepository.existsByUserId(userId))
                .events(List.of())
                .build();
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
            throw new RuntimeException("구글 캘린더 토큰 응답이 없습니다.");
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
            throw new RuntimeException("구글 캘린더 OAuth 설정이 필요합니다.");
        }
    }

    private void validateUserId(UUID userId) {
        if (userId == null) {
            throw new RuntimeException("사용자 ID가 필요합니다.");
        }
    }

    private void validateYearMonth(int year, int month) {
        if (year < 1 || month < 1 || month > 12) {
            throw new RuntimeException("조회할 연월이 올바르지 않습니다.");
        }
    }
}
