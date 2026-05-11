package com.mora.dto.ticket;

import com.mora.entity.Ticket;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Getter
@Setter
public class TicketResponse {

    private Integer id;
    private UUID userId;

    // 문서 유형 (ex.TICKET)
    private String docType;

    // 문서 분류 신뢰도
    private BigDecimal classificationConfidence;

    // 운송수단 (예: KTX, 버스 ..)
    private String transportType;

    private String departureLocation;
    private LocalDate departureDate;
    private LocalTime departureTime;

    private String arrivalLocation;
    private LocalDate arrivalDate;
    private LocalTime arrivalTime;

    // OCR 인식 전체 텍스트
    private String rawText;

    // 파싱된 구조화 데이터 원본 (JSON 문자열)
    private String parsedJson;

    // OCR 응답 전체 원본 (JSON 문자열)
    private String rawJson;

    // 티켓 최초 등록 일시
    private LocalDateTime createdAt;

    // 마지막 수정 날짜
    private LocalDateTime updatedAt;
    /*
     하이브리드 검색 최종 점수 (0~1) = Fuzzy점수 × 0.6 + Vector점수 × 0.4
     일반 목록/단건 조회 시에는 null.
     */
    private Double similarity;

    /**
     Ticket 엔티티 -> TicketResponse DTO로 변환.
     similarity는 설정x (하이브리드 검색이 아닌 일반 조회용).
     @param ticket Ticket 엔티티
     @return 변환된 TicketResponse
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
