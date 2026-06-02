package com.mora.service;

import com.mora.dto.api.ServiceResult;
import com.mora.dto.ticket.TicketResponse;
import com.mora.dto.ticket.TicketRequest;
import com.mora.entity.Ticket;
import com.mora.repository.TicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class TicketService {
    private static final Logger log = LoggerFactory.getLogger(TicketService.class);

    // 연도 있는 패턴 (우선 시도)
    private static final List<DateTimeFormatter> DATE_FORMATTERS_WITH_YEAR = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy.MM.dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyy년 MM월 dd일")
    );

    // 연도 없는 패턴 (연도 있는 패턴 모두 실패 시 시도)
    private static final List<DateTimeFormatter> DATE_FORMATTERS_WITHOUT_YEAR = List.of(
            DateTimeFormatter.ofPattern("MM.dd"),
            DateTimeFormatter.ofPattern("MM월 dd일")
    );

    // Fuzzy 검색 동적 임계값 시작점 (1.0 = 완전 일치만 허용)
    private static final double FUZZY_THRESHOLD_START = 1.0;
    // Fuzzy 검색 동적 임계값 최저점 (한국어 trigram 특성상 0.3이 적합)
    private static final double FUZZY_THRESHOLD_MIN = 0.3;
    // 임계값 감소 단위
    private static final double FUZZY_THRESHOLD_STEP = 0.1;

    // 하이브리드 점수 가중치: Fuzzy 60%, Vector 40%
    private static final double FUZZY_WEIGHT = 0.6;
    private static final double VECTOR_WEIGHT = 0.4;
    private static final double VECTOR_MIN_SCORE = 0.3;
    private static final double MIN_COMBINED_SCORE = 0.4;

    private static final String EMBEDDING_FAIL_MSG = "임베딩 생성 실패. Fuzzy 검색만 가능.";

    private final TicketRepository ticketRepository;
    private final EmbeddingService embeddingService;
    private final GoogleCalendarService googleCalendarService;

    public TicketService(TicketRepository ticketRepository,
                         EmbeddingService embeddingService,
                         GoogleCalendarService googleCalendarService) {
        this.ticketRepository = ticketRepository;
        this.embeddingService = embeddingService;
        this.googleCalendarService = googleCalendarService;
    }

    /**
     * 티켓을 저장한다.
     * rawText 배열을 공백으로 JOIN하여 TEXT로 저장하고,
     * 해당 텍스트로 OpenAI 임베딩을 생성하여 함께 저장한다.
     *
     * @param userId  티켓 소유자 사용자 ID
     * @param request 프론트엔드에서 전송한 티켓 데이터
     * @return 저장된 티켓의 응답 DTO
     */
    public ServiceResult<TicketResponse> save(UUID userId, TicketRequest request) {
        // rawText 배열을 공백으로 JOIN하여 하나의 문자열로 만든다
        // 예: ["서울", "부산", "KTX", "09:00"] → "서울 부산 KTX 09:00"
        String rawTextJoined = joinRawText(request.getRawText());

        // rawText로 OpenAI 임베딩 벡터를 생성한다 (실패 시 null 저장)
        String embedding = embeddingService.getEmbedding(rawTextJoined);

        // Ticket 엔티티 생성 및 필드 설정
        Ticket ticket = new Ticket();
        ticket.setUserId(userId);
        ticket.setDocType(request.getDocType());
        ticket.setClassificationConfidence(request.getClassificationConfidence());
        ticket.setTransportType(request.getTransportType());
        ticket.setDepartureLocation(request.getDepartureLocation());
        ticket.setDepartureDate(parseDate(request.getDepartureDate()));  // String → LocalDate 변환
        ticket.setDepartureTime(parseTime(request.getDepartureTime())); // String → LocalTime 변환
        ticket.setArrivalLocation(request.getArrivalLocation());
        ticket.setArrivalDate(parseDate(request.getArrivalDate()));    // String → LocalDate 변환
        ticket.setArrivalTime(parseTime(request.getArrivalTime()));    // String → LocalTime 변환
        ticket.setRawText(rawTextJoined);
        ticket.setParsedJson(request.getParsedJson());
        ticket.setRawJson(request.getRawJson());
        ticket.setEmbedding(embedding);

        // DB에 저장하고 응답 DTO로 변환하여 반환
        ticket = ticketRepository.save(ticket);
        TicketResponse response = TicketResponse.from(ticket);
        String calendarMessage = syncGoogleCalendar(userId, ticket);

        String message = combineMessages(embedding == null ? EMBEDDING_FAIL_MSG : null, calendarMessage);
        if (message != null) return ServiceResult.withMessage(response, message);
        return ServiceResult.ok(response);
    }

    // 특정 사용자의 특정 티켓을 조회(소유자가 아니거나 존재하지 않으면 RuntimeException을 던짐)
    public TicketResponse findById(UUID userId, Integer ticketId) {
        // userId + id 조건으로 조회하여 소유자 확인을 동시에 처리
        Ticket ticket = ticketRepository.findByIdAndUserId(ticketId, userId)
                .orElseThrow(() -> new RuntimeException("Ticket not found or unauthorized"));
        return TicketResponse.from(ticket);
    }

    // 특정 사용자의 티켓 목록을 최신순(생성일 내림차순)으로 페이지네이션 조회한다.
    public Page<TicketResponse> listByUser(UUID userId, int page, int size) {
        // 생성일 내림차순 정렬 Pageable 생성
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // 각 Ticket 엔티티를 TicketResponse DTO로 변환하여 반환
        return ticketRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(TicketResponse::from);
    }

    // 티켓 수정
    public ServiceResult<TicketResponse> update(UUID userId, Integer ticketId, TicketRequest request) {
        // 소유자 확인 포함 티켓 조회
        Ticket ticket = ticketRepository.findByIdAndUserId(ticketId, userId)
                .orElseThrow(() -> new RuntimeException("Ticket not found or unauthorized"));

        // 필드 업데이트 (null이 아닌 경우에만 수정)
        if (request.getDocType() != null) ticket.setDocType(request.getDocType());
        if (request.getClassificationConfidence() != null) ticket.setClassificationConfidence(request.getClassificationConfidence());
        if (request.getTransportType() != null) ticket.setTransportType(request.getTransportType());
        if (request.getDepartureLocation() != null) ticket.setDepartureLocation(request.getDepartureLocation());
        if (request.getDepartureDate() != null) ticket.setDepartureDate(parseDate(request.getDepartureDate()));
        if (request.getDepartureTime() != null) ticket.setDepartureTime(parseTime(request.getDepartureTime()));
        if (request.getArrivalLocation() != null) ticket.setArrivalLocation(request.getArrivalLocation());
        if (request.getArrivalDate() != null) ticket.setArrivalDate(parseDate(request.getArrivalDate()));
        if (request.getArrivalTime() != null) ticket.setArrivalTime(parseTime(request.getArrivalTime()));
        if (request.getParsedJson() != null) ticket.setParsedJson(request.getParsedJson());
        if (request.getRawJson() != null) ticket.setRawJson(request.getRawJson());

        // rawText가 전달된 경우 JOIN하여 업데이트하고 임베딩 재생성
        String newEmbedding = null;
        boolean embeddingAttempted = false;
        if (request.getRawText() != null && !request.getRawText().isEmpty()) {
            String rawTextJoined = joinRawText(request.getRawText());
            ticket.setRawText(rawTextJoined);
            // 텍스트가 바뀌었으므로 임베딩도 재생성
            newEmbedding = embeddingService.getEmbedding(rawTextJoined);
            ticket.setEmbedding(newEmbedding);
            embeddingAttempted = true;
        }

        ticket = ticketRepository.save(ticket);
        TicketResponse response = TicketResponse.from(ticket);
        String calendarMessage = syncGoogleCalendar(userId, ticket);

        String message = combineMessages(embeddingAttempted && newEmbedding == null ? EMBEDDING_FAIL_MSG : null, calendarMessage);
        if (message != null) return ServiceResult.withMessage(response, message);
        return ServiceResult.ok(response);
    }

    // 티켓 삭제
    public void delete(UUID userId, Integer ticketId) {
        // 소유자 확인 포함 티켓 조회
        Ticket ticket = ticketRepository.findByIdAndUserId(ticketId, userId)
                .orElseThrow(() -> new RuntimeException("Ticket not found or unauthorized"));
        ticketRepository.delete(ticket);
    }

    // 하이브리드 검색
    public ServiceResult<List<TicketResponse>> hybridSearch(UUID userId, String query, int topK) {

        // 1) 동적 임계값 Fuzzy 검색
        double threshold = FUZZY_THRESHOLD_START;
        List<Map<String, Object>> fuzzyResults = Collections.emptyList();

        while (fuzzyResults.size() < topK && threshold >= FUZZY_THRESHOLD_MIN) {
            fuzzyResults = ticketRepository.fuzzySearch(userId, query, threshold, topK);
            // 결과가 충분히 나오면 중단, 아니면 임계값을 낮춰 재시도
            if (fuzzyResults.size() < topK) {
                threshold = Math.round((threshold - FUZZY_THRESHOLD_STEP) * 10.0) / 10.0;
            } else {
                break;
            }
        }

        // fuzzy_score를 티켓 ID(key)로 매핑 (점수 합산 시 O(1) 조회)
        // Map<ticketId, fuzzyScore>
        Map<Integer, Double> fuzzyScoreMap = new HashMap<>();
        // Map<ticketId, 쿼리 결과 Row> — 나중에 TicketResponse 만들 때 사용
        Map<Integer, Map<String, Object>> fuzzyRowMap = new HashMap<>();
        for (Map<String, Object> row : fuzzyResults) {
            Integer id = ((Number) row.get("id")).intValue();
            double score = row.get("fuzzy_score") != null
                    ? ((Number) row.get("fuzzy_score")).doubleValue()
                    : 0.0;
            fuzzyScoreMap.put(id, score);
            fuzzyRowMap.put(id, row);
        }

        // 2) Vector 검색
        Map<Integer, Double> vectorScoreMap = new HashMap<>();
        Map<Integer, Map<String, Object>> vectorRowMap = new HashMap<>();
        boolean embeddingFailed = false;

        String queryEmbedding = embeddingService.getEmbedding(query);
        if (queryEmbedding != null) {
            List<Map<String, Object>> vectorResults = ticketRepository.vectorSearch(userId, queryEmbedding, topK);
            for (Map<String, Object> row : vectorResults) {
                Integer id = ((Number) row.get("id")).intValue();
                double score = row.get("vector_score") != null
                        ? ((Number) row.get("vector_score")).doubleValue()
                        : 0.0;
                if (score >= VECTOR_MIN_SCORE) {
                    vectorScoreMap.put(id, score);
                    vectorRowMap.put(id, row);
                }
            }
        } else {
            embeddingFailed = true;
        }

        // 3) 점수 합산 및 최종 정렬
        // fuzzy 결과가 있으면 fuzzy 결과만 대상으로 삼고, vector는 순위 보정용으로만 사용
        Set<Integer> allIds = new HashSet<>();
        if (!fuzzyScoreMap.isEmpty()) {
            allIds.addAll(fuzzyScoreMap.keySet());
        } else {
            allIds.addAll(vectorScoreMap.keySet());
        }

        // 각 티켓의 최종 점수 계산: Fuzzy × 0.6 + Vector × 0.4
        List<TicketResponse> results = new ArrayList<>();
        for (Integer id : allIds) {
            double fuzzyScore = fuzzyScoreMap.getOrDefault(id, 0.0);
            double vectorScore = vectorScoreMap.getOrDefault(id, 0.0);
            double combinedScore = fuzzyScore * FUZZY_WEIGHT + vectorScore * VECTOR_WEIGHT;

            if (combinedScore < MIN_COMBINED_SCORE) continue;

            // TicketResponse 생성 (Fuzzy Row 우선, 없으면 Vector Row 사용)
            Map<String, Object> row = fuzzyRowMap.containsKey(id)
                    ? fuzzyRowMap.get(id)
                    : vectorRowMap.get(id);

            TicketResponse response = mapRowToTicketResponse(row);
            response.setSimilarity(combinedScore);
            results.add(response);
        }

        // 최종 점수 내림차순 정렬 후 상위 topK개 반환
        results.sort((a, b) -> Double.compare(b.getSimilarity(), a.getSimilarity()));
        List<TicketResponse> topResults = results.stream().limit(topK).toList();

        if (embeddingFailed) return ServiceResult.withMessage(topResults, EMBEDDING_FAIL_MSG);
        return ServiceResult.ok(topResults);
    }

    // 날짜 문자열 -> LocalDate
    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;

        // 요일 제거: "(월)", "(화)", "(수)", "(목)", "(금)", "(토)", "(일)" 패턴 제거
        String cleaned = dateStr.replaceAll("\\([월화수목금토일]\\)", "").trim();

        // 연도 있는 패턴 순서대로 시도
        for (DateTimeFormatter formatter : DATE_FORMATTERS_WITH_YEAR) {
            try {
                return LocalDate.parse(cleaned, formatter);
            } catch (Exception ignored) {}
        }

        // 연도 없는 패턴 시도 → 현재 연도로 보완
        int currentYear = LocalDate.now().getYear();
        try {
            // "12.30" 형식
            if (cleaned.matches("\\d{1,2}\\.\\d{1,2}")) {
                String[] parts = cleaned.split("\\.");
                return LocalDate.of(currentYear, Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
            }
            // "12월 30일" 형식
            if (cleaned.contains("월") && cleaned.contains("일")) {
                String monthStr = cleaned.replaceAll("월.*", "").trim();
                String dayStr = cleaned.replaceAll(".*월\\s*", "").replaceAll("일", "").trim();
                return LocalDate.of(currentYear, Integer.parseInt(monthStr), Integer.parseInt(dayStr));
            }
        } catch (Exception ignored) {}

        // 모든 패턴 실패 시 null 반환
        return null;
    }

    // 시간 문자열 -> LocalTime
    private LocalTime parseTime(String timeStr) {
        if (timeStr == null || timeStr.isBlank()) return null;

        String cleaned = timeStr.trim();

        // "H:mm" 또는 "HH:mm" 형식 시도 (예: "9:00", "13:23")
        try {
            return LocalTime.parse(cleaned, DateTimeFormatter.ofPattern("H:mm"));
        } catch (Exception ignored) {}

        // "HH:mm:ss" 형식 시도 (예: "09:00:00")
        try {
            return LocalTime.parse(cleaned, DateTimeFormatter.ofPattern("H:mm:ss"));
        } catch (Exception ignored) {}

        // 한국어 오전/오후 형식 (예: "오전 9시", "오후 2시 30분")
        try {
            boolean isPm = cleaned.contains("오후");
            boolean isAm = cleaned.contains("오전");
            if (isPm || isAm) {
                String digitsOnly = cleaned.replaceAll("[^0-9]", " ").trim();
                String[] parts = digitsOnly.split("\\s+");
                if (parts.length >= 1) {
                    int hour = Integer.parseInt(parts[0]);
                    int minute = parts.length >= 2 ? Integer.parseInt(parts[1]) : 0;
                    if (isPm && hour < 12) hour += 12;
                    if (isAm && hour == 12) hour = 0;
                    return LocalTime.of(hour, minute);
                }
            }
        } catch (Exception ignored) {}

        // 모든 패턴 실패 시 null 반환
        return null;
    }

    // rawText 배열을 공백으로 JOIN하여 하나의 문자열로 만든다.
    private String joinRawText(List<String> rawTextList) {
        if (rawTextList == null || rawTextList.isEmpty()) return "";
        return String.join(" ", rawTextList);
    }

    private String syncGoogleCalendar(UUID userId, Ticket ticket) {
        try {
            Optional<String> eventId = googleCalendarService.syncTicketEvent(userId, ticket);
            if (eventId.isEmpty()
                    && ticket != null
                    && ticket.getDepartureDate() == null
                    && googleCalendarService.getConnected(userId).isConnected()) {
                return "구글 캘린더 동기화 건너뜀: 티켓 출발일을 인식하지 못했습니다.";
            }
            return null;
        } catch (RestClientResponseException e) {
            log.warn("Google Calendar sync failed for userId={}, ticketId={}, status={}, body={}",
                    userId,
                    ticket == null ? null : ticket.getId(),
                    e.getStatusCode(),
                    e.getResponseBodyAsString(),
                    e);
            return "구글 캘린더 동기화 실패: Google API 응답 " + e.getStatusCode();
        } catch (RuntimeException e) {
            log.warn("Google Calendar sync failed for userId={}, ticketId={}",
                    userId,
                    ticket == null ? null : ticket.getId(),
                    e);
            return "구글 캘린더 동기화 실패: " + e.getMessage();
        }
    }

    private String combineMessages(String... messages) {
        return Arrays.stream(messages)
                .filter(Objects::nonNull)
                .filter(message -> !message.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElse(null);
    }

    // 네이티브 쿼리 결과(Map)를 TicketResponse DTO로 변환한다.
    private TicketResponse mapRowToTicketResponse(Map<String, Object> row) {
        TicketResponse response = new TicketResponse();

        // 기본 필드 매핑 (네이티브 쿼리는 snake_case 컬럼명으로 반환)
        response.setId(((Number) row.get("id")).intValue());
        response.setUserId(UUID.fromString(row.get("user_id").toString()));
        response.setDocType((String) row.get("doc_type"));
        response.setTransportType((String) row.get("transport_type"));
        response.setDepartureLocation((String) row.get("departure_location"));
        response.setArrivalLocation((String) row.get("arrival_location"));
        response.setRawText((String) row.get("raw_text"));
        response.setParsedJson(row.get("parsed_json") != null ? row.get("parsed_json").toString() : null);
        response.setRawJson(row.get("raw_json") != null ? row.get("raw_json").toString() : null);

        // DATE 필드: java.sql.Date → LocalDate 변환
        if (row.get("departure_date") instanceof java.sql.Date) {
            response.setDepartureDate(((java.sql.Date) row.get("departure_date")).toLocalDate());
        }
        if (row.get("arrival_date") instanceof java.sql.Date) {
            response.setArrivalDate(((java.sql.Date) row.get("arrival_date")).toLocalDate());
        }

        // TIME 필드: java.sql.Time → LocalTime 변환
        if (row.get("departure_time") instanceof java.sql.Time) {
            response.setDepartureTime(((java.sql.Time) row.get("departure_time")).toLocalTime());
        }
        if (row.get("arrival_time") instanceof java.sql.Time) {
            response.setArrivalTime(((java.sql.Time) row.get("arrival_time")).toLocalTime());
        }

        // TIMESTAMP 필드: Instant 또는 java.sql.Timestamp → LocalDateTime 변환
        response.setCreatedAt(toLocalDateTime(row.get("created_at")));
        response.setUpdatedAt(toLocalDateTime(row.get("updated_at")));

        // classification_confidence: BigDecimal로 변환
        if (row.get("classification_confidence") != null) {
            response.setClassificationConfidence(
                    new java.math.BigDecimal(row.get("classification_confidence").toString())
            );
        }

        return response;
    }

    // TIMESTAMP 필드: Instant 또는 java.sql.Timestamp → LocalDateTime 변환
    private LocalDateTime toLocalDateTime(Object obj) {
        if (obj instanceof Instant) {
            return ((Instant) obj).atZone(ZoneId.systemDefault()).toLocalDateTime();
        } else if (obj instanceof java.sql.Timestamp) {
            return ((java.sql.Timestamp) obj).toLocalDateTime();
        }
        return null;
    }
}
