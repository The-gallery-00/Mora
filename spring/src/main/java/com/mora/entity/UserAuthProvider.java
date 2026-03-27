package com.mora.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * ═══════════════════════════════════════════════════════════════
 * UserAuthProvider — 소셜 로그인 제공자 연결 엔티티
 * ═══════════════════════════════════════════════════════════════
 *
 * [역할]
 * 하나의 사용자(User)가 여러 OAuth 제공자(Google/Kakao/Naver)와
 * 연결될 수 있도록 provider별 식별자를 저장하는 엔티티이다.
 * 기존 User 엔티티를 유지하면서도 다중 소셜 로그인 충돌을 막기 위해
 * 별도 매핑 테이블을 둔다.
 *
 * [왜 이 구조를 선택했는가]
 * 기존 User 엔티티에는 provider 필드가 하나만 있어서
 * "같은 사람이 Google과 Kakao 둘 다 로그인"하는 경우를 온전히 표현하기 어렵다.
 * 그래서 계정의 주체는 User로 유지하고, 제공자 연결 정보만 분리했다.
 * 이렇게 하면 기존 로컬 로그인 로직은 거의 건드리지 않으면서
 * 소셜 로그인 확장을 안전하게 추가할 수 있다.
 *
 * [보안/연동 관점]
 * OAuth 제공자는 이메일이 바뀌거나 제공되지 않을 수 있으므로,
 * provider + providerUserId 조합을 진짜 외부 식별자로 저장해야
 * 다른 사람 계정과 잘못 연결되는 위험을 줄일 수 있다.
 */
@Entity
@Table(name = "user_auth_providers")
public class UserAuthProvider {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String provider;

    @Column(nullable = false)
    private String providerUserId;

    private String providerEmail;

    private String providerName;

    private String picture;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    public UserAuthProvider() {
    }

    public UserAuthProvider(UUID id, UUID userId, String provider, String providerUserId, String providerEmail,
                            String providerName, String picture, LocalDateTime createdAt) {
        this.id = id;
        this.userId = userId;
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.providerEmail = providerEmail;
        this.providerName = providerName;
        this.picture = picture;
        this.createdAt = createdAt;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
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

    public String getProviderEmail() {
        return providerEmail;
    }

    public void setProviderEmail(String providerEmail) {
        this.providerEmail = providerEmail;
    }

    public String getProviderName() {
        return providerName;
    }

    public void setProviderName(String providerName) {
        this.providerName = providerName;
    }

    public String getPicture() {
        return picture;
    }

    public void setPicture(String picture) {
        this.picture = picture;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UserAuthProvider that = (UserAuthProvider) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
