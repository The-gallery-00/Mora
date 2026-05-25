package com.mora.repository;

import com.mora.entity.GoogleCalendarToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GoogleCalendarTokenRepository extends JpaRepository<GoogleCalendarToken, UUID> {

    Optional<GoogleCalendarToken> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);

    void deleteByUserId(UUID userId);
}
