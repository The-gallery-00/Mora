package com.mora.repository;

import com.mora.entity.BusinessCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BusinessCardRepository extends JpaRepository<BusinessCard, UUID> {

    // 페이지네이션 적용 목록 조회
    Page<BusinessCard> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    // 소유자 확인 포함 단건 조회
    Optional<BusinessCard> findByIdAndUserId(UUID id, UUID userId);

    //검색 대상 필드:name, company, position, phone, email, raw_ocr_text

    @Query(value = """
            SELECT bc.*,
                GREATEST(
                    COALESCE(similarity(bc.name, :query), 0),
                    COALESCE(similarity(bc.company, :query), 0),
                    COALESCE(similarity(bc.position, :query), 0),
                    COALESCE(similarity(bc.phone, :query), 0),
                    COALESCE(similarity(bc.email, :query), 0),
                    COALESCE(word_similarity(:query, bc.raw_ocr_text), 0)
                ) AS fuzzy_score
            FROM business_cards bc
            WHERE bc.user_id = :userId
              AND (
                  similarity(bc.name, :query) >= :threshold
                  OR similarity(bc.company, :query) >= :threshold
                  OR similarity(bc.position, :query) >= :threshold
                  OR similarity(bc.phone, :query) >= :threshold
                  OR similarity(bc.email, :query) >= :threshold
                  OR word_similarity(:query, bc.raw_ocr_text) >= :threshold
              )
            ORDER BY fuzzy_score DESC
            LIMIT :topK
            """, nativeQuery = true)
    List<Map<String, Object>> fuzzySearch(
            @Param("userId") UUID userId,
            @Param("query") String query,
            @Param("threshold") double threshold,
            @Param("topK") int topK
    );

    @Query(value = """
            SELECT *, 1 - (embedding <=> CAST(:vec AS vector)) AS vector_score
            FROM business_cards
            WHERE user_id = :userId AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :topK
            """, nativeQuery = true)
    List<Map<String, Object>> vectorSearch(
            @Param("userId") UUID userId,
            @Param("vec") String vec,
            @Param("topK") int topK
    );
}
