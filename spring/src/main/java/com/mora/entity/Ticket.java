package com.mora.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;

/**
 * ═══════════════════════════════════════════════════════════════
 * Ticket — 티켓 엔티티 (tickets 테이블 매핑)
 * ═══════════════════════════════════════════════════════════════
 *
 * [역할]
 * 데이터베이스의 tickets 테이블과 매핑되는 JPA 엔티티이다.
 * OCR로 인식된 티켓(교통편) 데이터를 저장하며, 출발/도착 정보,
 * 원본 OCR 텍스트, 파싱된 JSON, 임베딩 벡터 등을 관리한다.
 * TicketService에서 티켓 CRUD 작업 시 이 엔티티를 사용하고,
 * TicketRepository를 통해 DB에 영속화한다.
 *
 * [코드 흐름]
 * 1) TicketService.save()에서 Ticket 객체를 생성하고 필드를 설정한다.
 * 2) EmbeddingService에서 생성한 임베딩 벡터 문자열을 embedding 필드에 저장한다.
 * 3) TicketRepository.save()가 호출되면 JPA가 INSERT SQL을 실행한다.
 * 4) @PrePersist에 의해 createdAt, updatedAt이 자동으로 현재 시각으로 설정된다.
 * 5) @PreUpdate에 의해 수정 시 updatedAt이 자동 갱신된다.
 *
 * [id 타입 관련]
 * tickets.id는 SERIAL(int4) 타입이므로 Java Integer로 매핑한다.
 * BusinessCard와 달리 UUID가 아닌 자동 증가 정수를 사용한다.
 *
 * [JSONB 필드 관련]
 * parsedJson, rawJson은 PostgreSQL JSONB 타입이다.
 * Java에서는 String으로 저장하며, application.yml의
 * stringtype=unspecified 설정 덕분에 JDBC가 자동으로 JSONB로 캐스팅한다.
 *
 * [사용된 어노테이션/라이브러리]
 * ───────────────────────────────────────────
 * @Entity
 *   — JPA 엔티티 선언. DB 테이블과 매핑된다.
 *
 * @Table(name = "tickets")
 *   — 매핑할 테이블 이름을 "tickets"로 지정한다.
 *
 * @Id + @GeneratedValue(strategy = GenerationType.IDENTITY)
 *   — SERIAL(자동 증가 정수)을 기본 키로 사용. DB가 자동으로 값을 생성한다.
 *
 * @Column(columnDefinition = "jsonb")
 *   — parsedJson, rawJson 컬럼의 DB 타입을 jsonb로 지정한다.
 *
 * @Column(columnDefinition = "vector(1536)")
 *   — embedding 컬럼의 DB 타입을 pgvector vector(1536)으로 지정한다.
 *
 * @PrePersist / @PreUpdate
 *   — 최초 저장 시 createdAt·updatedAt 설정, 수정 시 updatedAt 갱신.
 * ───────────────────────────────────────────
 */
@Entity
@Table(name = "tickets")
public class Ticket {

    /** 티켓 고유 ID (SERIAL, 자동 증가 정수, 기본 키) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /** 이 티켓을 등록한 사용자의 ID (FK 역할, NOT NULL) */
    @Column(nullable = false)
    private UUID userId;

    // ─── 문서 분류 정보 ───────────────────────────────────────

    /** OCR 서버가 분류한 문서 유형 (예: "TICKET") */
    @Column(nullable = false, length = 30)
    private String docType;

    /** 문서 분류 신뢰도 (예: 0.950, 소수점 3자리) */
    @Column(precision = 4, scale = 3)
    private BigDecimal classificationConfidence;

    // ─── 교통편 핵심 정보 ──────────────────────────────────────

    /** 운송수단 (예: KTX, 항공, 버스) */
    @Column(length = 50)
    private String transportType;

    // ─── 출발 정보 ────────────────────────────────────────────

    /** 출발지 (예: 서울, 인천공항) */
    @Column(length = 255)
    private String departureLocation;

    /** 출발 날짜 */
    private LocalDate departureDate;

    /** 출발 시간 */
    private LocalTime departureTime;

    // ─── 도착 정보 ────────────────────────────────────────────

    /** 도착지 (예: 부산, 제주) */
    @Column(length = 255)
    private String arrivalLocation;

    /** 도착 날짜 */
    private LocalDate arrivalDate;

    /** 도착 시간 */
    private LocalTime arrivalTime;

    // ─── OCR 및 원본 데이터 ───────────────────────────────────

    /** OCR 인식 텍스트 배열을 공백으로 JOIN한 전체 텍스트 (임베딩 입력용) */
    @Column(columnDefinition = "TEXT")
    private String rawText;

    /** 파싱된 구조화 데이터 원본 (JSONB) */
    @Column(columnDefinition = "jsonb")
    private String parsedJson;

    /** OCR 응답 전체 원본 (JSONB) */
    @Column(columnDefinition = "jsonb")
    private String rawJson;

    // ─── 벡터 검색 ────────────────────────────────────────────

    /** rawText를 OpenAI text-embedding-ada-002로 임베딩한 1536차원 벡터 */
    @Column(columnDefinition = "vector(1536)")
    private String embedding;

    // ─── 시스템 컬럼 ──────────────────────────────────────────

    /** 티켓 최초 등록 일시 (INSERT 시 자동 설정, UPDATE 시 변경 불가) */
    @Column(updatable = false)
    private LocalDateTime createdAt;

    /** 티켓 마지막 수정 일시 (INSERT/UPDATE 시 자동 갱신) */
    private LocalDateTime updatedAt;

    public Ticket() {
    }

    /**
     * 엔티티가 처음 DB에 저장되기 직전 호출되어
     * createdAt과 updatedAt을 현재 시각으로 설정한다.
     */
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 엔티티가 수정될 때마다 호출되어 updatedAt을 현재 시각으로 갱신한다.
     */
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ─── Getter / Setter ──────────────────────────────────────

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

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

    public LocalDate getDepartureDate() {
        return departureDate;
    }

    public void setDepartureDate(LocalDate departureDate) {
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

    public LocalDate getArrivalDate() {
        return arrivalDate;
    }

    public void setArrivalDate(LocalDate arrivalDate) {
        this.arrivalDate = arrivalDate;
    }

    public LocalTime getArrivalTime() {
        return arrivalTime;
    }

    public void setArrivalTime(LocalTime arrivalTime) {
        this.arrivalTime = arrivalTime;
    }

    public String getRawText() {
        return rawText;
    }

    public void setRawText(String rawText) {
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

    public String getEmbedding() {
        return embedding;
    }

    public void setEmbedding(String embedding) {
        this.embedding = embedding;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Ticket ticket = (Ticket) o;
        return Objects.equals(id, ticket.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Ticket{" +
                "id=" + id +
                ", userId=" + userId +
                ", transportType='" + transportType + '\'' +
                ", departureLocation='" + departureLocation + '\'' +
                ", arrivalLocation='" + arrivalLocation + '\'' +
                '}';
    }
}
