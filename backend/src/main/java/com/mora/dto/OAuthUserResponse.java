package com.mora.dto;

/**
 * OAuthUserResponse — provider별 사용자 정보를 내부 공통 형식으로 정규화한 DTO
 *
 * 외부 응답 포맷은 Google/Kakao/Naver가 모두 다르다.
 * 하지만 이후 로직은 "어떤 제공자인가"보다
 * "외부 식별자, 이메일, 이름, 프로필 사진이 무엇인가"가 중요하므로
 * 서비스 계층 진입 직전에 한 번 공통 형식으로 맞춘다.
 * 이렇게 해야 AuthService가 provider별 JSON 구조를 몰라도 되고,
 * 로컬 로그인과 소셜 로그인을 같은 JWT 발급 흐름으로 연결하기 쉽다.
 */
public class OAuthUserResponse {

    private String provider;
    private String providerUserId;
    private String email;
    private String name;
    private String picture;

    public OAuthUserResponse() {
    }

    public OAuthUserResponse(String provider, String providerUserId, String email, String name, String picture) {
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.email = email;
        this.name = name;
        this.picture = picture;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderUserId() {
        return providerUserId;
    }

    public void setProviderUserId(String providerUserId) {
        this.providerUserId = providerUserId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPicture() {
        return picture;
    }

    public void setPicture(String picture) {
        this.picture = picture;
    }
}
