package com.mora.dto.user;

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
public class UserResponse {

    private UUID id;
    private String email;
    private String name;
    // 프로필 사진 URL
    private String picture;
    // 가입 제공자 ("local" | "google" | "kakao" | "naver")
    // 프론트가 소셜 전용 계정에서 비밀번호 변경을 차단하기 위해 사용
    private String provider;
    // 계정 생성 시각
    private LocalDateTime createdAt;
}
