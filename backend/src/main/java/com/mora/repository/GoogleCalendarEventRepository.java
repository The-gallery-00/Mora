package com.mora.repository;

import com.mora.entity.GoogleCalendarEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GoogleCalendarEventRepository extends JpaRepository<GoogleCalendarEvent, UUID> {

    Optional<GoogleCalendarEvent> findByUserIdAndDocumentTypeAndDocumentId(
            UUID userId,
            String documentType,
            String documentId
    );

    long countByUserId(UUID userId);

    void deleteByUserId(UUID userId);
}
