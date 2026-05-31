package com.mora.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "receipts")
public class Receipt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 30)
    private String docType = "RECEIPT";

    @Column(precision = 4, scale = 3)
    private BigDecimal classificationConfidence;

    @Column(length = 255)
    private String merchantName;

    @Column(columnDefinition = "TEXT")
    private String merchantAddress;

    private LocalDate purchaseDate;

    private LocalTime purchaseTime;

    @Column(length = 50)
    private String paymentMethod;

    @Column(length = 100)
    private String cardCompany;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(length = 10)
    private String currencyCode = "KRW";

    @Column(columnDefinition = "TEXT")
    private String rawText;

    @Column(columnDefinition = "jsonb")
    @org.hibernate.annotations.ColumnTransformer(write = "?::jsonb")
    private String parsedJson;

    @Column(columnDefinition = "jsonb")
    @org.hibernate.annotations.ColumnTransformer(write = "?::jsonb")
    private String rawJson;

    @Column(columnDefinition = "vector(1536)")
    @org.hibernate.annotations.ColumnTransformer(write = "?::vector")
    private String embedding;

    @OneToMany(mappedBy = "receipt", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ReceiptItem> items = new ArrayList<>();

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

    public void replaceItems(List<ReceiptItem> newItems) {
        items.clear();
        if (newItems == null) return;
        for (ReceiptItem item : newItems) {
            addItem(item);
        }
    }

    public void addItem(ReceiptItem item) {
        item.setReceipt(this);
        items.add(item);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Receipt receipt = (Receipt) o;
        return Objects.equals(id, receipt.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
