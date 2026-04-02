package com.mora.dto;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/**
 * ═══════════════════════════════════════════════════════════════
 * TicketSaveRequest — 티켓 저장/수정 요청 DTO
 * ═══════════════════════════════════════════════════════════════
 *
 * [역할]
 * 클라이언트가 티켓을 저장(POST /api/tickets/save) 또는
 * 수정(PUT /api/tickets/{id}) 할 때 전송하는 JSON 요청 바디를 매핑하는 DTO이다.
 *
 * [OCR 서버가 보내는 원본 JSON 형식]
 * {
 *   "type": "TICKET",
 *   "confidence": 0.95,
 *   "parsed": {
 *     "transport_type": "KTX",
 *     "departure_location": "서울",
 *     "departure_date": "2025-12-01",
 *     "departure_time": "09:00",
 *     "arrival_location": "부산",
 *     "arrival_date": "2025-12-01",
 *     "arrival_time": "11:30"
 *   },
 *   "raw_text": ["서울", "부산", "KTX", "09:00"],  ← 배열
 *   "raw_json": { ... }
 * }
 *
 * [프론트에서 이 DTO로 보내는 JSON 형식]
 * 프론트가 OCR 결과를 사용자에게 보여준 뒤, 사용자가 수정하고 저장 버튼을 누르면
 * 아래 형식으로 Spring으로 전송한다.
 * {
 *   "docType": "TICKET",
 *   "classificationConfidence": 0.95,
 *   "transportType": "KTX",
 *   "departureLocation": "서울",
 *   "departureDate": "2025-12-01",
 *   "departureTime": "09:00",
 *   "arrivalLocation": "부산",
 *   "arrivalDate": "2025-12-01",
 *   "arrivalTime": "11:30",
 *   "rawText": ["서울", "부산", "KTX", "09:00"],   ← 배열로 받아 JOIN 처리
 *   "parsedJson": "{...}",                          ← 문자열화된 JSON
 *   "rawJson": "{...}"                              ← 문자열화된 JSON
 * }
 *
 * [rawText 처리]
 * OCR 서버가 raw_text를 배열로 보내므로, DTO에서는 List<String>으로 받는다.
 * TicketService에서 공백으로 JOIN하여 TEXT 컬럼에 저장한다.
 *
 * [코드 흐름]
 * 1) 클라이언트가 JSON 요청 바디를 전송한다.
 * 2) @RequestBody에 의해 Jackson이 JSON → TicketSaveRequest 객체로 역직렬화한다.
 * 3) TicketController에서 TicketService.save() 또는 update()에 이 객체를 전달한다.
 * 4) TicketService에서 각 getter로 필드를 읽어 Ticket 엔티티에 설정한다.
 *
 * [사용된 어노테이션/라이브러리]
 * ───────────────────────────────────────────
 * (별도 어노테이션 없음 — 순수 POJO DTO)
 * Jackson이 setter 메서드와 필드명을 기반으로 JSON 역직렬화를 수행한다.
 * LocalDate: Jackson이 "2025-12-01" 문자열을 자동 파싱한다.
 * LocalTime: Jackson이 "09:00" 문자열을 자동 파싱한다.
 * ───────────────────────────────────────────
 */
public class TicketSaveRequest {

    // ─── 문서 분류 정보 ───────────────────────────────────────

    /** OCR 서버가 분류한 문서 유형 (예: "TICKET") */
    private String docType;

    /** 문서 분류 신뢰도 (예: 0.95) */
    private BigDecimal classificationConfidence;

    // ─── 교통편 핵심 정보 ──────────────────────────────────────

    /** 운송수단 (예: KTX, 항공, 버스) */
    private String transportType;

    // ─── 출발 정보 ────────────────────────────────────────────

    /** 출발지 (예: 서울, 인천공항) */
    private String departureLocation;

    /**
     * 출발 날짜 (문자열로 수신 — 다양한 형식 허용)
     * 예: "2025-12-01", "2025.12.01", "2025/12/01",
     *     "2025년 12월 1일", "2025-12-01(월)", "12.01", "12월 1일"
     * TicketService에서 parseDate()로 LocalDate 변환 후 저장
     */
    private String departureDate;

    /** 출발 시간 (예: 09:00 — HH:mm 형식만 존재) */
    private LocalTime departureTime;

    // ─── 도착 정보 ────────────────────────────────────────────

    /** 도착지 (예: 부산, 제주) */
    private String arrivalLocation;

    /**
     * 도착 날짜 (문자열로 수신 — 다양한 형식 허용)
     * 예: "2025-12-01", "2025.12.01", "2025/12/01",
     *     "2025년 12월 1일", "2025-12-01(월)", "12.01", "12월 1일"
     * TicketService에서 parseDate()로 LocalDate 변환 후 저장
     */
    private String arrivalDate;

    /** 도착 시간 (예: 11:30) */
    private LocalTime arrivalTime;

    // ─── OCR 및 원본 데이터 ───────────────────────────────────

    /**
     * OCR 인식 텍스트 배열 (예: ["서울", "부산", "KTX", "09:00"]).
     * TicketService에서 공백으로 JOIN하여 TEXT 컬럼에 저장한다.
     */
    private List<String> rawText;

    /** 파싱된 구조화 데이터 원본 (JSON 문자열, DB에 JSONB로 저장) */
    private String parsedJson;

    /** OCR 응답 전체 원본 (JSON 문자열, DB에 JSONB로 저장) */
    private String rawJson;

    public TicketSaveRequest() {
    }

    // ─── Getter / Setter ──────────────────────────────────────

    public String getDocType() {
        return docType;
    }

    public void setDocType(String docType) {
        this.docType = docType;
    }

    public BigDecimal getClassificationConfidence() {
        return classificationConfidence;
    }

    public void setClassificationConfidence(BigDecimal classificationConfidence) {
        this.classificationConfidence = classificationConfidence;
    }

    public String getTransportType() {
        return transportType;
    }

    public void setTransportType(String transportType) {
        this.transportType = transportType;
    }

    public String getDepartureLocation() {
        return departureLocation;
    }

    public void setDepartureLocation(String departureLocation) {
        this.departureLocation = departureLocation;
    }

    public String getDepartureDate() {
        return departureDate;
    }

    public void setDepartureDate(String departureDate) {
        this.departureDate = departureDate;
    }

    public LocalTime getDepartureTime() {
        return departureTime;
    }

    public void setDepartureTime(LocalTime departureTime) {
        this.departureTime = departureTime;
    }

    public String getArrivalLocation() {
        return arrivalLocation;
    }

    public void setArrivalLocation(String arrivalLocation) {
        this.arrivalLocation = arrivalLocation;
    }

    public String getArrivalDate() {
        return arrivalDate;
    }

    public void setArrivalDate(String arrivalDate) {
        this.arrivalDate = arrivalDate;
    }

    public LocalTime getArrivalTime() {
        return arrivalTime;
    }

    public void setArrivalTime(LocalTime arrivalTime) {
        this.arrivalTime = arrivalTime;
    }

    public List<String> getRawText() {
        return rawText;
    }

    public void setRawText(List<String> rawText) {
        this.rawText = rawText;
    }

    public String getParsedJson() {
        return parsedJson;
    }

    public void setParsedJson(String parsedJson) {
        this.parsedJson = parsedJson;
    }

    public String getRawJson() {
        return rawJson;
    }

    public void setRawJson(String rawJson) {
        this.rawJson = rawJson;
    }
}
