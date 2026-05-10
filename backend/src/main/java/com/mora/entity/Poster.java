package com.mora.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "posters")
public class Poster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 30)
    private String docType;

    @Column(precision = 4, scale = 3)
    private BigDecimal classificationConfidence;

    @Column(length = 255)
    private String title;

    @Column(length = 150)
    private String organizerName;

    private LocalDate eventStartDate;

    private LocalDate eventEndDate;

    @Column(length = 50)
    private String contactPhone;

    @Column(length = 150)
    private String contactEmail;

    @Column(length = 255)
    private String location;

    @Column(length = 100)
    private String fee;

    @Column(columnDefinition = "TEXT")
    private String websiteUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String rawText;

    @Column(columnDefinition = "jsonb")
    private String parsedJson;

    @Column(columnDefinition = "jsonb")
    private String rawJson;

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

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Poster poster = (Poster) o;
        return Objects.equals(id, poster.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
