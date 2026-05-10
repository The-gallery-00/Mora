package com.mora.dto;

import com.mora.entity.Ticket;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * ═══════════════════════════════════════════════════════════════
 * TicketResponse — 티켓 응답 DTO
 * ═══════════════════════════════════════════════════════════════
 *
 * [역할]
 * 티켓 조회, 저장, 수정, 검색 결과를 클라이언트에 반환할 때 사용하는 DTO이다.
 * Ticket 엔티티의 내부 구조(embedding, JPA 관련)를 외부에 노출하지 않고,
 * 필요한 필드만 선별하여 전달한다.
 * 하이브리드 검색 결과에는 similarity(최종 가중 점수)가 추가로 포함된다.
 *
 * [코드 흐름]
 * 1) TicketService에서 Ticket 엔티티를 조회/저장한 뒤
 *    TicketResponse.from(ticket)을 호출하여 DTO로 변환한다.
 * 2) 하이브리드 검색 시에는 from() 후 setSimilarity()로 점수를 추가 설정한다.
 * 3) TicketController에서 ApiResponse.ok(ticketResponse)로 감싸 반환한다.
 *
 * [similarity 필드]
 * 하이브리드 검색 최종 점수 = Fuzzy점수 × 0.6 + Vector점수 × 0.4
 * 일반 목록/단건 조회 시에는 null로 반환된다.
 *
 * [사용된 어노테이션/라이브러리]
 * ───────────────────────────────────────────
 * @Getter / @Setter (Lombok)
 *   — 모든 필드에 대한 getter/setter를 컴파일 시점에 자동 생성한다.
 *     직접 작성할 필요가 없어 코드가 간결해진다.
 * ───────────────────────────────────────────
 */
@Getter
@Setter
public class TicketResponse {

    /** 티켓 고유 ID */
    private Integer id;

    /** 티켓 소유자 사용자 ID */
    private UUID userId;

    // ─── 문서 분류 정보 ───────────────────────────────────────

    /** 문서 유형 (예: "TICKET") */
    private String docType;

    /** 문서 분류 신뢰도 */
    private BigDecimal classificationConfidence;

    // ─── 교통편 핵심 정보 ──────────────────────────────────────

    /** 운송수단 (예: KTX, 항공, 버스) */
    private String transportType;

    // ─── 출발 정보 ────────────────────────────────────────────

    /** 출발지 */
    private String departureLocation;

    /** 출발 날짜 */
    private LocalDate departureDate;

    /** 출발 시간 */
    private LocalTime departureTime;

    // ─── 도착 정보 ────────────────────────────────────────────

    /** 도착지 */
    private String arrivalLocation;

    /** 도착 날짜 */
    private LocalDate arrivalDate;

    /** 도착 시간 */
    private LocalTime arrivalTime;

    // ─── OCR 및 원본 데이터 ───────────────────────────────────

    /** OCR 인식 전체 텍스트 */
    private String rawText;

    /** 파싱된 구조화 데이터 원본 (JSON 문자열) */
    private String parsedJson;

    /** OCR 응답 전체 원본 (JSON 문자열) */
    private String rawJson;

    // ─── 시스템 컬럼 ──────────────────────────────────────────

    /** 티켓 최초 등록 일시 */
    private LocalDateTime createdAt;

    /** 티켓 마지막 수정 일시 */
    private LocalDateTime updatedAt;

    // ─── 검색 결과 전용 ───────────────────────────────────────

    /**
     * 하이브리드 검색 최종 점수 (0~1).
     * = Fuzzy점수 × 0.6 + Vector점수 × 0.4
     * 일반 목록/단건 조회 시에는 null.
     */
    private Double similarity;

    /**
     * Ticket 엔티티를 TicketResponse DTO로 변환하는 정적 팩토리 메서드.
     * similarity는 설정하지 않는다 (하이브리드 검색이 아닌 일반 조회용).
     *
     * @param ticket Ticket 엔티티
     * @return 변환된 TicketResponse
     */
    public static TicketResponse from(Ticket ticket) {
        TicketResponse response = new TicketResponse();
        response.setId(ticket.getId());
        response.setUserId(ticket.getUserId());
        response.setDocType(ticket.getDocType());
        response.setClassificationConfidence(ticket.getClassificationConfidence());
        response.setTransportType(ticket.getTransportType());
        response.setDepartureLocation(ticket.getDepartureLocation());
        response.setDepartureDate(ticket.getDepartureDate());
        response.setDepartureTime(ticket.getDepartureTime());
        response.setArrivalLocation(ticket.getArrivalLocation());
        response.setArrivalDate(ticket.getArrivalDate());
        response.setArrivalTime(ticket.getArrivalTime());
        response.setRawText(ticket.getRawText());
        response.setParsedJson(ticket.getParsedJson());
        response.setRawJson(ticket.getRawJson());
        response.setCreatedAt(ticket.getCreatedAt());
        response.setUpdatedAt(ticket.getUpdatedAt());
        return response;
    }
}
