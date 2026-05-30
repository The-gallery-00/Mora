package com.mora.service;

import com.mora.dto.oauth.GoogleTokenResponse;
import com.mora.dto.oauth.GoogleUserResponse;
import com.mora.dto.calendar.GoogleCalendarConnectedResponse;
import com.mora.dto.calendar.GoogleCalendarMonthResponse;
import com.mora.dto.calendar.GoogleCalendarTokenResponse;
import com.mora.entity.GoogleCalendarEvent;
import com.mora.entity.GoogleCalendarToken;
import com.mora.entity.Poster;
import com.mora.entity.Ticket;
import com.mora.entity.user.User;
import com.mora.repository.GoogleCalendarEventRepository;
import com.mora.repository.GoogleCalendarTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class GoogleCalendarService {

    private static final String CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
    private static final String PROFILE_SCOPE = "openid email profile";
    private static final String PRIMARY_CALENDAR_ID = "primary";
    private static final String GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter GOOGLE_DATE_TIME_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final RestTemplate restTemplate;
    private final GoogleCalendarTokenRepository tokenRepository;
    private final GoogleCalendarEventRepository eventRepository;
    private final CalendarOAuthStateService stateService;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public GoogleCalendarService(RestTemplate restTemplate,
                                 GoogleCalendarTokenRepository tokenRepository,
                                 GoogleCalendarEventRepository eventRepository,
                                 CalendarOAuthStateService stateService,
                                 @Value("${app.calendar.google.client-id}") String clientId,
                                 @Value("${app.calendar.google.client-secret}") String clientSecret,
                                 @Value("${app.calendar.google.redirect-uri}") String redirectUri) {
        this.restTemplate = restTemplate;
        this.tokenRepository = tokenRepository;
        this.eventRepository = eventRepository;
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

    @Transactional
    public Optional<String> syncTicketEvent(UUID userId, Ticket ticket) {
        validateUserId(userId);
        if (ticket == null || ticket.getId() == null || ticket.getDepartureDate() == null) {
            return Optional.empty();
        }

        return syncDocumentEvent(userId, "TICKET", String.valueOf(ticket.getId()), buildTicketEvent(ticket));
    }

    @Transactional
    public Optional<String> syncPosterEvent(UUID userId, Poster poster) {
        validateUserId(userId);
        if (poster == null || poster.getId() == null || poster.getEventStartDate() == null) {
            return Optional.empty();
        }

        return syncDocumentEvent(userId, "POSTER", String.valueOf(poster.getId()), buildPosterEvent(poster));
    }

    private Optional<String> syncDocumentEvent(
            UUID userId,
            String documentType,
            String documentId,
            Map<String, Object> eventBody
    ) {
        Optional<GoogleCalendarToken> tokenOptional = tokenRepository.findByUserId(userId);
        if (tokenOptional.isEmpty()) {
            return Optional.empty();
        }

        Optional<GoogleCalendarEvent> existingEvent = eventRepository
                .findByUserIdAndDocumentTypeAndDocumentId(userId, documentType, documentId);

        String accessToken = getUsableAccessToken(tokenOptional.get());
        if (existingEvent.isPresent()) {
            updateGoogleEvent(accessToken, existingEvent.get().getGoogleEventId(), eventBody);
            return Optional.of(existingEvent.get().getGoogleEventId());
        }

        Map<?, ?> response = insertGoogleEvent(accessToken, eventBody);
        Object eventId = response.get("id");
        if (eventId == null || eventId.toString().isBlank()) {
            throw new RuntimeException("구글 캘린더 이벤트 ID를 받지 못했습니다.");
        }

        GoogleCalendarEvent event = new GoogleCalendarEvent();
        event.setUserId(userId);
        event.setDocumentType(documentType);
        event.setDocumentId(documentId);
        event.setGoogleEventId(eventId.toString());
        event.setCalendarId(PRIMARY_CALENDAR_ID);
        eventRepository.save(event);

        return Optional.of(event.getGoogleEventId());
    }

    private void updateGoogleEvent(String accessToken, String googleEventId, Map<String, Object> eventBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        restTemplate.exchange(
                GOOGLE_EVENTS_URL + "/" + googleEventId,
                HttpMethod.PUT,
                new HttpEntity<>(eventBody, headers),
                Map.class
        );
    }

    private Map<?, ?> insertGoogleEvent(String accessToken, Map<String, Object> eventBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> response = restTemplate.exchange(
                GOOGLE_EVENTS_URL,
                HttpMethod.POST,
                new HttpEntity<>(eventBody, headers),
                Map.class
        );

        Map<?, ?> body = response.getBody();
        if (body == null) {
            throw new RuntimeException("구글 캘린더 이벤트 생성 응답이 없습니다.");
        }
        return body;
    }

    private Map<String, Object> buildTicketEvent(Ticket ticket) {
        String summary = buildTicketSummary(ticket);
        String description = joinNonBlank(
                "MORA에서 저장된 티켓 일정입니다.",
                label("교통수단", ticket.getTransportType()),
                label("출발", ticket.getDepartureLocation()),
                label("도착", ticket.getArrivalLocation())
        );

        Map<String, Object> event = new java.util.HashMap<>();
        event.put("summary", summary);
        event.put("description", description);
        String location = joinNonBlank(ticket.getDepartureLocation(), ticket.getArrivalLocation());
        if (!location.isBlank()) {
            event.put("location", location);
        }

        if (ticket.getDepartureTime() == null) {
            event.put("start", Map.of("date", ticket.getDepartureDate().toString()));
            event.put("end", Map.of("date", ticket.getDepartureDate().plusDays(1).toString()));
            return event;
        }

        LocalDateTime start = LocalDateTime.of(ticket.getDepartureDate(), ticket.getDepartureTime());
        LocalDate arrivalDate = ticket.getArrivalDate() == null ? ticket.getDepartureDate() : ticket.getArrivalDate();
        LocalTime arrivalTime = ticket.getArrivalTime() == null ? ticket.getDepartureTime().plusHours(1) : ticket.getArrivalTime();
        LocalDateTime end = LocalDateTime.of(arrivalDate, arrivalTime);
        if (!end.isAfter(start)) {
            end = start.plusHours(1);
        }

        event.put("start", googleDateTime(start));
        event.put("end", googleDateTime(end));
        return event;
    }

    private Map<String, Object> buildPosterEvent(Poster poster) {
        LocalDate startDate = poster.getEventStartDate();
        LocalDate endDate = poster.getEventEndDate() == null ? startDate : poster.getEventEndDate();
        if (endDate.isBefore(startDate)) {
            endDate = startDate;
        }

        Map<String, Object> event = new java.util.HashMap<>();
        event.put("summary", hasText(poster.getTitle()) ? poster.getTitle() : "이벤트");
        event.put("start", Map.of("date", startDate.toString()));
        event.put("end", Map.of("date", endDate.plusDays(1).toString()));
        if (hasText(poster.getLocation())) {
            event.put("location", poster.getLocation());
        }
        event.put("description", joinNonBlank(
                "MORA에서 저장된 포스터 일정입니다.",
                label("주최", poster.getOrganizerName()),
                label("연락처", poster.getContactPhone()),
                label("이메일", poster.getContactEmail()),
                label("참가비", poster.getFee()),
                label("웹사이트", poster.getWebsiteUrl()),
                poster.getDescription()
        ));
        return event;
    }

    private String getUsableAccessToken(GoogleCalendarToken token) {
        if (token.getExpiresAt() == null || token.getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(2))) {
            return token.getAccessToken();
        }
        if (token.getRefreshToken() == null || token.getRefreshToken().isBlank()) {
            throw new RuntimeException("구글 캘린더 재연동이 필요합니다.");
        }

        GoogleTokenResponse refreshed = refreshAccessToken(token.getRefreshToken());
        if (refreshed.getAccessToken() == null || refreshed.getAccessToken().isBlank()) {
            throw new RuntimeException("구글 캘린더 토큰 갱신에 실패했습니다.");
        }

        token.setAccessToken(refreshed.getAccessToken());
        token.setExpiresAt(toExpiresAt(refreshed.getExpiresIn()));
        if (refreshed.getScope() != null) {
            token.setScope(refreshed.getScope());
        }
        tokenRepository.save(token);
        return token.getAccessToken();
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

    private GoogleTokenResponse refreshAccessToken(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("refresh_token", refreshToken);
        form.add("grant_type", "refresh_token");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<GoogleTokenResponse> response = restTemplate.postForEntity(
                "https://oauth2.googleapis.com/token",
                new HttpEntity<>(form, headers),
                GoogleTokenResponse.class
        );
        GoogleTokenResponse body = response.getBody();
        if (body == null) {
            throw new RuntimeException("구글 캘린더 토큰 갱신 응답이 없습니다.");
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

    private Map<String, String> googleDateTime(LocalDateTime value) {
        return Map.of(
                "dateTime", value.atZone(DEFAULT_ZONE).format(GOOGLE_DATE_TIME_FORMATTER),
                "timeZone", DEFAULT_ZONE.getId()
        );
    }

    private String buildTicketSummary(Ticket ticket) {
        String departure = hasText(ticket.getDepartureLocation()) ? ticket.getDepartureLocation() : "출발";
        String arrival = hasText(ticket.getArrivalLocation()) ? ticket.getArrivalLocation() : "도착";
        if (hasText(ticket.getTransportType())) {
            return "[" + ticket.getTransportType() + "] " + departure + " → " + arrival;
        }
        return departure + " → " + arrival;
    }

    private String label(String label, String value) {
        if (!hasText(value)) {
            return "";
        }
        return label + ": " + value;
    }

    private String joinNonBlank(String... values) {
        return java.util.Arrays.stream(values)
                .filter(this::hasText)
                .reduce((left, right) -> left + "\n" + right)
                .orElse("");
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
