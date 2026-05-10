package com.mora.repository;

import com.mora.entity.user.UserAuthProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * UserAuthProviderRepository — 소셜 로그인 제공자 매핑 조회 리포지토리
 *
 * OAuth 로그인에서는 이메일만으로 기존 사용자를 판별하면
 * 잘못된 계정 연결 위험이 있으므로, provider + providerUserId 조합을
 * 우선 조회하는 전용 리포지토리가 필요하다.
 */
@Repository
public interface UserAuthProviderRepository extends JpaRepository<UserAuthProvider, UUID> {

    Optional<UserAuthProvider> findByProviderAndProviderUserId(String provider, String providerUserId);
}
