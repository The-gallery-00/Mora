package com.mora.service;

import com.mora.dto.TicketResponse;
import com.mora.dto.TicketSaveRequest;
import com.mora.entity.Ticket;
import com.mora.repository.TicketRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * ═══════════════════════════════════════════════════════════════
 * TicketService — 티켓 CRUD 및 하이브리드 검색 비즈니스 로직 서비스
 * ═══════════════════════════════════════════════════════════════
 *
 * [역할]
 * 티켓의 저장, 단건 조회, 목록 조회(페이지네이션), 수정, 삭제,
 * 하이브리드 검색(pg_trgm Fuzzy + pgvector) 비즈니스 로직을 처리한다.
 * TicketController에서 호출되며, TicketRepository를 통해 DB에 접근하고,
 * EmbeddingService를 통해 텍스트 임베딩을 생성한다.
 *
 * [코드 흐름]
 * 1) 저장 (save):
 *    → rawText 배열을 공백 JOIN → OpenAI로 임베딩 생성 → Ticket 엔티티 저장
 * 2) 단건 조회 (findById):
 *    → userId + id로 소유자 확인 포함 조회
 * 3) 목록 조회 (listByUser):
 *    → 페이지네이션 포함 최신순 조회
 * 4) 수정 (update):
 *    → 소유자 확인 → 필드 업데이트 → 임베딩 재생성 → 저장
 * 5) 삭제 (delete):
 *    → 소유자 확인 → DB에서 삭제
 * 6) 하이브리드 검색 (hybridSearch):
 *    → 동적 임계값 Fuzzy 검색 + Vector 검색 → 60:40 가중 합산 → 상위 K개 반환
 *
 * [하이브리드 검색 상세]
 * ───────────────────────────────────────────
 * [Fuzzy 검색 — 동적 임계값]
 * threshold를 1.0에서 시작하여 결과가 topK개 이상 나올 때까지
 * 0.1씩 낮춰간다. 최저 임계값은 0.6이다.
 * (예: 1.0 → 0.9 → 0.8 → ... → 0.6)
 *
 * [Vector 검색]
 * 검색 쿼리를 OpenAI 임베딩으로 변환하여 pgvector 코사인 유사도 검색.
 *
 * [점수 합산]
 * 최종 점수 = Fuzzy점수 × 0.6 + Vector점수 × 0.4
 * 한쪽 검색에만 나온 결과는 없는 쪽 점수를 0으로 처리한다.
 * 최종 점수로 내림차순 정렬 후 상위 topK개를 반환한다.
 * ───────────────────────────────────────────
 *
 * [사용된 어노테이션/라이브러리]
 * ───────────────────────────────────────────
 * @Service
 *   — 서비스 계층 빈 선언.
 *
 * TicketRepository
 *   — save(), findByIdAndUserId(), findByUserIdOrderByCreatedAtDesc(),
 *     delete(), fuzzySearch(), vectorSearch() 사용.
 *
 * EmbeddingService
 *   — getEmbedding(text): 텍스트를 OpenAI API로 벡터 변환.
 *
 * Page<Ticket>
 *   — 페이지네이션 결과 (content, totalElements, totalPages 등 포함).
 *
 * PageRequest.of(page, size, Sort)
 *   — 페이지 번호, 크기, 정렬 방향을 지정한 Pageable 생성.
 * ───────────────────────────────────────────
 */
@Service
public class TicketService {

    // ─── 날짜 파싱용 포맷터 목록 ──────────────────────────────────────────────
    // 연도 있는 패턴 (우선 시도)
    private static final List<DateTimeFormatter> DATE_FORMATTERS_WITH_YEAR = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),       // 2025-12-30
            DateTimeFormatter.ofPattern("yyyy.MM.dd"),       // 2025.12.30
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),       // 2025/12/30
            DateTimeFormatter.ofPattern("yyyy년 MM월 dd일")  // 2025년 12월 30일
    );

    // 연도 없는 패턴 (연도 있는 패턴 모두 실패 시 시도)
    private static final List<DateTimeFormatter> DATE_FORMATTERS_WITHOUT_YEAR = List.of(
            DateTimeFormatter.ofPattern("MM.dd"),            // 12.30
            DateTimeFormatter.ofPattern("MM월 dd일")         // 12월 30일
    );

    // Fuzzy 검색 동적 임계값 시작점 (1.0 = 완전 일치만 허용)
    private static final double FUZZY_THRESHOLD_START = 1.0;
    // Fuzzy 검색 동적 임계값 최저점 (0.6 미만은 너무 관련 없는 결과)
    private static final double FUZZY_THRESHOLD_MIN = 0.6;
    // 임계값 감소 단위
    private static final double FUZZY_THRESHOLD_STEP = 0.1;

    // 하이브리드 점수 가중치: Fuzzy 60%, Vector 40%
    private static final double FUZZY_WEIGHT = 0.6;
    private static final double VECTOR_WEIGHT = 0.4;

    private final TicketRepository ticketRepository;
    private final EmbeddingService embeddingService;

    public TicketService(TicketRepository ticketRepository, EmbeddingService embeddingService) {
        this.ticketRepository = ticketRepository;
        this.embeddingService = embeddingService;
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
    public TicketResponse save(UUID userId, TicketSaveRequest request) {
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
        ticket.setDepartureTime(request.getDepartureTime());
        ticket.setArrivalLocation(request.getArrivalLocation());
        ticket.setArrivalDate(parseDate(request.getArrivalDate()));    // String → LocalDate 변환
        ticket.setArrivalTime(request.getArrivalTime());
        ticket.setRawText(rawTextJoined);
        ticket.setParsedJson(request.getParsedJson());
        ticket.setRawJson(request.getRawJson());
        ticket.setEmbedding(embedding);

        // DB에 저장하고 응답 DTO로 변환하여 반환
        ticket = ticketRepository.save(ticket);
        return TicketResponse.from(ticket);
    }

    /**
     * 특정 사용자의 특정 티켓을 단건 조회한다.
     * 소유자가 아니거나 존재하지 않으면 RuntimeException을 던진다.
     *
     * @param userId   요청 사용자 ID
     * @param ticketId 조회할 티켓 ID
     * @return 티켓 응답 DTO
     */
    public TicketResponse findById(UUID userId, Integer ticketId) {
        // userId + id 조건으로 조회하여 소유자 확인을 동시에 처리
        Ticket ticket = ticketRepository.findByIdAndUserId(ticketId, userId)
                .orElseThrow(() -> new RuntimeException("Ticket not found or unauthorized"));
        return TicketResponse.from(ticket);
    }

    /**
     * 특정 사용자의 티켓 목록을 최신순(생성일 내림차순)으로 페이지네이션 조회한다.
     *
     * @param userId 조회할 사용자 ID
     * @param page   페이지 번호 (0부터 시작)
     * @param size   페이지당 항목 수
     * @return 페이지네이션이 적용된 TicketResponse 페이지
     */
    public Page<TicketResponse> listByUser(UUID userId, int page, int size) {
        // 생성일 내림차순 정렬 Pageable 생성
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // 각 Ticket 엔티티를 TicketResponse DTO로 변환하여 반환
        return ticketRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(TicketResponse::from);
    }

    /**
     * 티켓 정보를 수정한다.
     * 소유자가 아닌 경우 RuntimeException을 던진다.
     * 수정 후 임베딩 벡터도 재생성한다.
     *
     * @param userId   요청 사용자 ID
     * @param ticketId 수정할 티켓 ID
     * @param request  수정할 데이터
     * @return 수정된 티켓 응답 DTO
     */
    public TicketResponse update(UUID userId, Integer ticketId, TicketSaveRequest request) {
        // 소유자 확인 포함 티켓 조회
        Ticket ticket = ticketRepository.findByIdAndUserId(ticketId, userId)
                .orElseThrow(() -> new RuntimeException("Ticket not found or unauthorized"));

        // 필드 업데이트 (null이 아닌 경우에만 수정)
        if (request.getDocType() != null) ticket.setDocType(request.getDocType());
        if (request.getClassificationConfidence() != null) ticket.setClassificationConfidence(request.getClassificationConfidence());
        if (request.getTransportType() != null) ticket.setTransportType(request.getTransportType());
        if (request.getDepartureLocation() != null) ticket.setDepartureLocation(request.getDepartureLocation());
        if (request.getDepartureDate() != null) ticket.setDepartureDate(parseDate(request.getDepartureDate()));
        if (request.getDepartureTime() != null) ticket.setDepartureTime(request.getDepartureTime());
        if (request.getArrivalLocation() != null) ticket.setArrivalLocation(request.getArrivalLocation());
        if (request.getArrivalDate() != null) ticket.setArrivalDate(parseDate(request.getArrivalDate()));
        if (request.getArrivalTime() != null) ticket.setArrivalTime(request.getArrivalTime());
        if (request.getParsedJson() != null) ticket.setParsedJson(request.getParsedJson());
        if (request.getRawJson() != null) ticket.setRawJson(request.getRawJson());

        // rawText가 전달된 경우 JOIN하여 업데이트하고 임베딩 재생성
        if (request.getRawText() != null && !request.getRawText().isEmpty()) {
            String rawTextJoined = joinRawText(request.getRawText());
            ticket.setRawText(rawTextJoined);
            // 텍스트가 바뀌었으므로 임베딩도 재생성
            ticket.setEmbedding(embeddingService.getEmbedding(rawTextJoined));
        }

        ticket = ticketRepository.save(ticket);
        return TicketResponse.from(ticket);
    }

    /**
     * 티켓을 삭제한다.
     * 소유자가 아닌 경우 RuntimeException을 던진다.
     *
     * @param userId   요청 사용자 ID
     * @param ticketId 삭제할 티켓 ID
     */
    public void delete(UUID userId, Integer ticketId) {
        // 소유자 확인 포함 티켓 조회
        Ticket ticket = ticketRepository.findByIdAndUserId(ticketId, userId)
                .orElseThrow(() -> new RuntimeException("Ticket not found or unauthorized"));
        ticketRepository.delete(ticket);
    }

    /**
     * 하이브리드 검색 (pg_trgm Fuzzy + pgvector Vector)을 수행한다.
     *
     * [검색 과정]
     * 1) 동적 임계값 Fuzzy 검색:
     *    threshold를 1.0부터 시작하여 결과가 topK개 이상 나올 때까지 0.1씩 낮춘다.
     *    최저 임계값은 0.6이다.
     *
     * 2) Vector 검색:
     *    검색 쿼리를 OpenAI 임베딩으로 변환하여 pgvector 코사인 유사도 검색.
     *    임베딩 생성 실패 시 Vector 점수는 0으로 처리한다.
     *
     * 3) 점수 합산 및 정렬:
     *    최종 점수 = Fuzzy점수 × 0.6 + Vector점수 × 0.4
     *    최종 점수로 내림차순 정렬 후 상위 topK개 반환.
     *
     * @param userId 검색 대상 사용자 ID
     * @param query  검색 키워드 (예: "인천 부산 KTX")
     * @param topK   반환할 최대 결과 수
     * @return 유사도 점수 포함 티켓 응답 DTO 리스트 (최대 topK개)
     */
    public List<TicketResponse> hybridSearch(UUID userId, String query, int topK) {

        // ── 1단계: 동적 임계값 Fuzzy 검색 ──────────────────────────────────
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

        // ── 2단계: Vector 검색 ───────────────────────────────────────────────
        Map<Integer, Double> vectorScoreMap = new HashMap<>();
        Map<Integer, Map<String, Object>> vectorRowMap = new HashMap<>();

        String queryEmbedding = embeddingService.getEmbedding(query);
        if (queryEmbedding != null) {
            List<Map<String, Object>> vectorResults = ticketRepository.vectorSearch(userId, queryEmbedding, topK);
            for (Map<String, Object> row : vectorResults) {
                Integer id = ((Number) row.get("id")).intValue();
                double score = row.get("vector_score") != null
                        ? ((Number) row.get("vector_score")).doubleValue()
                        : 0.0;
                vectorScoreMap.put(id, score);
                vectorRowMap.put(id, row);
            }
        }

        // ── 3단계: 점수 합산 및 최종 정렬 ───────────────────────────────────
        // 두 검색 결과에 등장한 모든 티켓 ID를 수집
        Set<Integer> allIds = new HashSet<>();
        allIds.addAll(fuzzyScoreMap.keySet());
        allIds.addAll(vectorScoreMap.keySet());

        // 각 티켓의 최종 점수 계산: Fuzzy × 0.6 + Vector × 0.4
        List<TicketResponse> results = new ArrayList<>();
        for (Integer id : allIds) {
            double fuzzyScore = fuzzyScoreMap.getOrDefault(id, 0.0);
            double vectorScore = vectorScoreMap.getOrDefault(id, 0.0);
            double combinedScore = fuzzyScore * FUZZY_WEIGHT + vectorScore * VECTOR_WEIGHT;

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
        return results.stream().limit(topK).toList();
    }

    /**
     * 다양한 형식의 날짜 문자열을 LocalDate로 변환한다.
     *
     * [처리 순서]
     * 1) null 또는 빈 문자열 → null 반환
     * 2) 요일 제거 → "(월)", "(화)" 등 괄호 부분 제거
     *    예: "2025-12-30(월)" → "2025-12-30" -> 요일 추가는 추후에 보완.
     * 3) 연도 있는 패턴 순서대로 시도
     *    예: "2025-12-30", "2025.12.30", "2025/12/30", "2025년 12월 30일"
     * 4) 연도 없는 패턴 시도 → 현재 연도로 보완
     *    예: "12.30" → LocalDate(현재연도, 12, 30)
     *        "12월 30일" → LocalDate(현재연도, 12, 30)
     * 5) 모든 패턴 실패 → null 반환
     *
     * @param dateStr OCR에서 추출된 날짜 문자열
     * @return 파싱된 LocalDate, 실패 시 null
     */
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

    /**
     * rawText 배열을 공백으로 JOIN하여 하나의 문자열로 만든다.
     * null이거나 비어있으면 빈 문자열을 반환한다.
     *
     * @param rawTextList OCR 인식 텍스트 배열 (예: ["서울", "부산", "KTX"])
     * @return JOIN된 문자열 (예: "서울 부산 KTX")
     */
    private String joinRawText(List<String> rawTextList) {
        if (rawTextList == null || rawTextList.isEmpty()) return "";
        return String.join(" ", rawTextList);
    }

    /**
     * 네이티브 쿼리 결과(Map)를 TicketResponse DTO로 변환한다.
     * created_at, updated_at은 DB 드라이버에 따라 Instant 또는 Timestamp로 올 수 있으므로
     * 두 경우를 모두 처리한다.
     *
     * @param row 네이티브 쿼리 결과 Map (컬럼명 → 값)
     * @return 변환된 TicketResponse (similarity는 설정하지 않음)
     */
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

    /**
     * DB에서 반환된 TIMESTAMP 값을 LocalDateTime으로 변환한다.
     * JDBC 드라이버에 따라 Instant 또는 java.sql.Timestamp로 올 수 있다.
     *
     * @param obj DB에서 반환된 TIMESTAMP 값
     * @return LocalDateTime (변환 불가 시 null)
     */
    private LocalDateTime toLocalDateTime(Object obj) {
        if (obj instanceof Instant) {
            return ((Instant) obj).atZone(ZoneId.systemDefault()).toLocalDateTime();
        } else if (obj instanceof java.sql.Timestamp) {
            return ((java.sql.Timestamp) obj).toLocalDateTime();
        }
        return null;
    }
}
