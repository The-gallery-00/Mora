package com.mora.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tickets")
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 30)
    private String docType;

    // 문서 분류 신뢰도 (ex. 0.950, 소수점 3자리)
    @Column(precision = 4, scale = 3)
    private BigDecimal classificationConfidence;

    @Column(length = 50)
    private String transportType;

    @Column(length = 255)
    private String departureLocation;

    private LocalDate departureDate;

    private LocalTime departureTime;

    @Column(length = 255)
    private String arrivalLocation;

    private LocalDate arrivalDate;

    private LocalTime arrivalTime;

    // OCR 인식 텍스트 배열을 공백으로 조인한 전체 텍스트 (임베딩 입력용)
    @Column(columnDefinition = "TEXT")
    private String rawText;

    // 파싱된 구조화 데이터 원본 (JSONB)
    @Column(columnDefinition = "jsonb")
    private String parsedJson;

    // OCR 응답 전체 원본 (JSONB)
    @Column(columnDefinition = "jsonb")
    private String rawJson;

    // rawText를 OpenAI text-embedding-ada-002로 임베딩한 1536차원 벡터
    @Column(columnDefinition = "vector(1536)")
    private String embedding;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

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
