package com.mora.repository;

import com.mora.entity.user.UserAuthProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserAuthProviderRepository extends JpaRepository<UserAuthProvider, UUID> {

    Optional<UserAuthProvider> findByProviderAndProviderUserId(String provider, String providerUserId);
}
