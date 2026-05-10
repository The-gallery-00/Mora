package com.mora.repository;

import com.mora.entity.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * ═══════════════════════════════════════════════════════════════
 * TicketRepository — 티켓(Ticket) 데이터 접근 리포지토리
 * ═══════════════════════════════════════════════════════════════
 *
 * [역할]
 * Ticket 엔티티에 대한 CRUD, 페이지네이션 조회, Fuzzy 검색, 벡터 검색을 제공하는
 * Spring Data JPA 리포지토리 인터페이스이다.
 * TicketService에서 티켓 저장, 목록 조회, 수정, 삭제, 하이브리드 검색에 사용된다.
 *
 * [코드 흐름]
 * 1) TicketService가 이 리포지토리를 주입받아 사용한다.
 * 2) 티켓 저장: save()로 INSERT/UPDATE.
 * 3) 목록 조회: findByUserIdOrderByCreatedAtDesc()로 사용자별 최신순 페이지 조회.
 * 4) 단건 조회: findByIdAndUserId()로 소유자 확인을 포함한 단건 조회.
 * 5) Fuzzy 검색: fuzzySearch()로 pg_trgm 유사도 기반 검색.
 * 6) 벡터 검색: vectorSearch()로 pgvector 코사인 유사도 기반 검색.
 *
 * [하이브리드 검색 전략]
 * TicketService에서 fuzzySearch()와 vectorSearch()를 각각 호출한 뒤,
 * 결과를 병합하여 최종 점수 = Fuzzy점수 × 0.6 + Vector점수 × 0.4 로 계산한다.
 *
 * [pg_trgm Fuzzy Search 관련]
 * ───────────────────────────────────────────
 * similarity(a, b): 두 문자열의 트라이그램 유사도 (0~1).
 * word_similarity(query, text): 쿼리가 긴 텍스트의 일부와 얼마나 유사한지 (0~1).
 *   raw_text처럼 긴 텍스트에는 word_similarity를 사용한다.
 * GREATEST(...): 여러 필드 중 가장 높은 유사도 점수를 최종 fuzzy_score로 사용.
 * COALESCE(..., 0): 필드가 NULL이면 0으로 처리.
 * threshold: TicketService에서 동적으로 조정되는 임계값 (1.0 → 0.6, 0.1씩 감소).
 * ───────────────────────────────────────────
 *
 * [pgvector 관련]
 * ───────────────────────────────────────────
 * embedding <=> CAST(:vec AS vector): <=> 는 pgvector의 코사인 거리 연산자.
 *   결과값이 작을수록 유사도가 높다.
 * 1 - (embedding <=> ...): 코사인 거리를 코사인 유사도(0~1)로 변환.
 * ───────────────────────────────────────────
 *
 * [사용된 어노테이션/라이브러리]
 * ───────────────────────────────────────────
 * @Repository
 *   — 데이터 접근 계층 표시. JPA 프록시가 자동 생성된다.
 *
 * JpaRepository<Ticket, Integer>
 *   — 표준 CRUD 메서드를 자동 제공한다.
 *
 * @Query(nativeQuery = true)
 *   — JPQL 대신 네이티브 SQL을 직접 작성한다.
 *     pg_trgm, pgvector 등 PostgreSQL 전용 기능을 사용하기 위해 필요하다.
 *
 * Page<Ticket>
 *   — 페이지네이션 결과를 담는 Spring Data 인터페이스.
 *     content(데이터), totalElements(전체 수), totalPages(전체 페이지 수) 등을 제공한다.
 * ───────────────────────────────────────────
 */
@Repository
public interface TicketRepository extends JpaRepository<Ticket, Integer> {

    /**
     * 특정 사용자의 티켓 목록을 생성일 내림차순(최신순)으로 페이지네이션 조회한다.
     *
     * @param userId   조회할 사용자 ID
     * @param pageable 페이지 번호, 크기, 정렬 정보 (예: PageRequest.of(0, 10))
     * @return 페이지네이션이 적용된 티켓 목록
     */
    Page<Ticket> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /**
     * 특정 사용자의 특정 티켓을 조회한다.
     * 소유자 확인을 포함하므로 다른 사용자의 티켓은 조회되지 않는다.
     *
     * @param id     조회할 티켓 ID
     * @param userId 요청 사용자 ID (소유자 확인용)
     * @return 티켓 (없거나 소유자가 다르면 empty)
     */
    Optional<Ticket> findByIdAndUserId(Integer id, UUID userId);

    /**
     * pg_trgm 유사도 기반으로 티켓을 Fuzzy 검색한다.
     *
     * [검색 대상 필드]
     * - departure_location: 출발지 (similarity 사용)
     * - arrival_location:   도착지 (similarity 사용)
     * - transport_type:     운송수단 (similarity 사용)
     * - raw_text:           전체 OCR 텍스트 (word_similarity 사용 — 긴 텍스트용)
     *
     * [fuzzy_score]
     * 4개 필드 중 가장 높은 유사도 점수를 최종 fuzzy_score로 사용한다.
     *
     * [threshold 동적 조정]
     * TicketService에서 결과가 topK개 이상 나올 때까지 threshold를
     * 1.0 → 0.9 → 0.8 → ... → 0.6 으로 0.1씩 낮춰가며 재호출한다.
     *
     * @param userId    검색 대상 사용자 ID
     * @param query     검색 키워드 (예: "인천", "KTX")
     * @param threshold 최소 유사도 임계값 (0.6 ~ 1.0)
     * @param topK      반환할 최대 결과 수
     * @return 티켓 데이터 + fuzzy_score를 포함한 Map 리스트
     */
    @Query(value = """
            SELECT t.*,
                GREATEST(
                    COALESCE(similarity(t.departure_location, :query), 0),
                    COALESCE(similarity(t.arrival_location, :query), 0),
                    COALESCE(similarity(t.transport_type, :query), 0),
                    COALESCE(word_similarity(:query, t.raw_text), 0)
                ) AS fuzzy_score
            FROM tickets t
            WHERE t.user_id = :userId
              AND (
                  similarity(t.departure_location, :query) >= :threshold
                  OR similarity(t.arrival_location, :query) >= :threshold
                  OR similarity(t.transport_type, :query) >= :threshold
                  OR word_similarity(:query, t.raw_text) >= :threshold
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

    /**
     * pgvector 코사인 유사도 기반으로 티켓을 벡터 검색한다.
     * 임베딩이 있는 티켓 중 검색 쿼리 벡터와 가장 유사한 topK개를 반환한다.
     *
     * @param userId 검색 대상 사용자 ID
     * @param vec    검색 쿼리의 임베딩 벡터 문자열 (예: "[0.1, 0.2, ...]")
     * @param topK   반환할 최대 결과 수
     * @return 티켓 데이터 + vector_score를 포함한 Map 리스트
     */
    @Query(value = """
            SELECT *, 1 - (embedding <=> CAST(:vec AS vector)) AS vector_score
            FROM tickets
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
