package com.mora.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "business_cards")
public class BusinessCard {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    private String name;

    private String company;

    private String position;

    private String phone;

    private String email;

    // OCR로 인식된 원본 텍스트 전체 (TEXT 타입)
    @Column(columnDefinition = "TEXT")
    private String rawOcrText;

    // 명함 이미지 URL (S3 같은 외부 저장소 경로)
    private String imageUrl;

    private UUID groupId;

    // 임베딩 벡터
    @Column(columnDefinition = "vector(1536)")
    private String embedding;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BusinessCard that = (BusinessCard) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "BusinessCard{" +
                "id=" + id +
                ", userId=" + userId +
                ", name='" + name + '\'' +
                ", company='" + company + '\'' +
                '}';
    }
}
