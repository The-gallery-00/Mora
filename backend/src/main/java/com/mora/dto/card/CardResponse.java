package com.mora.dto.card;

import com.mora.entity.BusinessCard;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CardResponse {

    private UUID id;
    private String name;
    private String company;
    private String position;
    private String phone;
    private String email;
    // OCR로 인식된 원본 텍스트 전체
    private String rawOcrText;
    // 명함 이미지 URL
    private String imageUrl;
    private LocalDateTime createdAt;
    // 벡터 검색 시 코사인 유사도 점수 (0~1)
    private Double similarity;

    /**
     * BusinessCard 엔티티 -> CardResponse DTO로 변환.
     * similarity는 설정x (벡터 검색이 아닌 일반 조회용).
     */
    public static CardResponse from(BusinessCard card) {
        CardResponse response = new CardResponse();
        response.setId(card.getId());
        response.setName(card.getName());
        response.setCompany(card.getCompany());
        response.setPosition(card.getPosition());
        response.setPhone(card.getPhone());
        response.setEmail(card.getEmail());
        response.setRawOcrText(card.getRawOcrText());
        response.setImageUrl(card.getImageUrl());
        response.setCreatedAt(card.getCreatedAt());
        return response;
    }
}
