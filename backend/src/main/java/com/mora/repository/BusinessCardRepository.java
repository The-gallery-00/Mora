package com.mora.repository;

import com.mora.entity.BusinessCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public interface BusinessCardRepository extends JpaRepository<BusinessCard, UUID> {

    /** 특정 사용자의 명함 목록을 생성일 내림차순(최신순)으로 조회한다. */
    List<BusinessCard> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * pgvector 코사인 유사도 기반으로 명함을 검색한다.
     * 임베딩이 있는 명함 중 주어진 벡터와 가장 유사한 topK개를 반환한다.
     */
    @Query(value = """
            SELECT *, 1 - (embedding <=> CAST(:vec AS vector)) AS similarity
            FROM business_cards
            WHERE user_id = :userId AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :topK
            """, nativeQuery = true)
    List<Map<String, Object>> searchByVector(
            @Param("userId") UUID userId,
            @Param("vec") String vec,
            @Param("topK") int topK
    );
}
