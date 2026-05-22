package com.mora.dto.card;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CardRequest {

    private String name;
    private String company;
    private String position;
    private String phone;
    private String email;
    // OCR로 인식된 원본 텍스트 전체
    private String rawOcrText;
    // 명함 이미지 url
    private String imageUrl;
}
