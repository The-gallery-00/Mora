package com.mora.repository;

import com.mora.entity.BusinessCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * [역할]
 * BusinessCard 엔티티에 대한 CRUD 및 벡터 유사도 검색을 제공하는
 * Spring Data JPA 리포지토리 인터페이스이다.
 * CardService에서 명함 저장, 목록 조회, 수정, 삭제, 유사도 검색에 사용된다.
 *
 * [코드 흐름]
 * 1) CardService가 이 리포지토리를 주입받아 사용한다.
 * 2) 명함 저장: save()로 INSERT/UPDATE.
 * 3) 목록 조회: findByUserIdOrderByCreatedAtDesc()로 사용자별 최신순 조회.
 * 4) 삭제: delete()로 엔티티 삭제.
 * 5) 벡터 검색: searchByVector()로 pgvector 코사인 유사도 기반 검색.
 *
 * [메서드 목록]
 * - findByUserIdOrderByCreatedAtDesc(UUID userId):
 *   특정 사용자의 명함을 생성일 내림차순으로 조회한다.
 * - searchByVector(UUID userId, String vec, int topK):
 *   pgvector의 코사인 거리 연산자(<=>)로 유사도 검색을 수행한다.
 * - (상속) save(), findById(), delete() 등: JpaRepository 기본 CRUD.
 *
 * [pgvector 관련]
 * ───────────────────────────────────────────
 * embedding <=> CAST(:vec AS vector)
 *   — <=> 는 pgvector의 코사인 거리 연산자이다.
 *     결과값이 작을수록 유사도가 높다.
 *
 * 1 - (embedding <=> CAST(:vec AS vector)) AS similarity
 *   — 코사인 거리를 코사인 유사도(0~1)로 변환한다.
 *     1이면 완전히 동일, 0이면 완전히 다름.
 * ───────────────────────────────────────────
 */
@Repository
public interface BusinessCardRepository extends JpaRepository<BusinessCard, UUID> {

    // 특정 사용자의 명함 목록을 생성 최신순으로 조회
    List<BusinessCard> findByUserIdOrderByCreatedAtDesc(UUID userId);

    // 소유자 확인 포함 단건 조회
    Optional<BusinessCard> findByIdAndUserId(UUID id, UUID userId);

    /**
     * pgvector 코사인 유사도 기반으로 명함을 검색한다.
     * 임베딩이 있는 명함 중 주어진 벡터와 가장 유사한 topK개를 반환한다.
     *
     * @param userId 검색 대상 사용자 ID
     * @param vec    검색 쿼리의 임베딩 벡터 문자열 (예: "[0.1, 0.2, ...]")
     * @param topK   반환할 최대 결과 수
     * @return 명함 데이터 + similarity 점수를 포함한 Map 리스트
     */
    /**
     * //pg_trgm 유사도 기반으로 명함을 Fuzzy 검색한다.
     *
     * [검색 대상 필드]
     * - name:         이름 (similarity 사용)
     * - company:      회사명 (similarity 사용)
     * - position:     직함 (similarity 사용)
     * - phone:        전화번호 (similarity 사용)
     * - email:        이메일 (similarity 사용)
     * - raw_ocr_text: 전체 OCR 텍스트 (word_similarity 사용 — 긴 텍스트용)
     */
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
    List<Map<String, Object>> searchByVector(
            @Param("userId") UUID userId,
            @Param("vec") String vec,
            @Param("topK") int topK
    );
}
