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
