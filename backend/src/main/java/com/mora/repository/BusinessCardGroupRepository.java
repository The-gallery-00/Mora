package com.mora.repository;

import com.mora.entity.BusinessCardGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BusinessCardGroupRepository extends JpaRepository<BusinessCardGroup, UUID> {

    List<BusinessCardGroup> findByUserIdOrderByCreatedAtAsc(UUID userId);

    Optional<BusinessCardGroup> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndName(UUID userId, String name);
}
