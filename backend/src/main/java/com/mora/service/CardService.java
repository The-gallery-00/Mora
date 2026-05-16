package com.mora.service;

import com.mora.dto.api.ServiceResult;
import com.mora.dto.card.CardResponse;
import com.mora.dto.card.CardSaveRequest;
import com.mora.entity.BusinessCard;
import com.mora.repository.BusinessCardRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.util.*;

@Service
public class CardService {

    private static final double FUZZY_THRESHOLD_START = 1.0;
    private static final double FUZZY_THRESHOLD_MIN = 0.6;
    private static final double FUZZY_THRESHOLD_STEP = 0.1;
    private static final double FUZZY_WEIGHT = 0.6;
    private static final double VECTOR_WEIGHT = 0.4;

    private static final String EMBEDDING_FAIL_MSG = "임베딩 생성 실패. Fuzzy 검색만 가능.";

    private final BusinessCardRepository cardRepository;
    private final EmbeddingService embeddingService;

    public CardService(BusinessCardRepository cardRepository, EmbeddingService embeddingService) {
        this.cardRepository = cardRepository;
        this.embeddingService = embeddingService;
    }

    public ServiceResult<CardResponse> save(UUID userId, CardSaveRequest request) {
        String textForEmbedding = buildEmbeddingText(
                request.getName(), request.getCompany(), request.getPosition(),
                request.getPhone(), request.getEmail(), request.getRawOcrText()
        );
        String embedding = embeddingService.getEmbedding(textForEmbedding);

        BusinessCard card = new BusinessCard();
        card.setUserId(userId);
        card.setName(request.getName());
        card.setCompany(request.getCompany());
        card.setPosition(request.getPosition());
        card.setPhone(request.getPhone());
        card.setEmail(request.getEmail());
        card.setRawOcrText(request.getRawOcrText());
        card.setImageUrl(request.getImageUrl());
        card.setEmbedding(embedding);

        card = cardRepository.save(card);
        CardResponse response = CardResponse.from(card);

        if (embedding == null) return ServiceResult.withMessage(response, EMBEDDING_FAIL_MSG);
        return ServiceResult.ok(response);
    }

    public List<CardResponse> listByUser(UUID userId) {
        return cardRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(CardResponse::from)
                .toList();
    }

    public ServiceResult<CardResponse> update(UUID userId, UUID cardId, CardSaveRequest request) {
        BusinessCard card = cardRepository.findById(cardId)
                .orElseThrow(() -> new RuntimeException("Card not found"));

        if (!card.getUserId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }

        // 필드 업데이트 (null이 아닌 경우에만 수정 - 부분 수정 지원)
        if (request.getName() != null) card.setName(request.getName());
        if (request.getCompany() != null) card.setCompany(request.getCompany());
        if (request.getPosition() != null) card.setPosition(request.getPosition());
        if (request.getPhone() != null) card.setPhone(request.getPhone());
        if (request.getEmail() != null) card.setEmail(request.getEmail());
        if (request.getRawOcrText() != null) card.setRawOcrText(request.getRawOcrText());
        if (request.getImageUrl() != null) card.setImageUrl(request.getImageUrl());

        String textForEmbedding = buildEmbeddingText(
                card.getName(), card.getCompany(), card.getPosition(),
                card.getPhone(), card.getEmail(), card.getRawOcrText()
        );
        String newEmbedding = embeddingService.getEmbedding(textForEmbedding);
        card.setEmbedding(newEmbedding);

        card = cardRepository.save(card);
        CardResponse response = CardResponse.from(card);

        if (newEmbedding == null) return ServiceResult.withMessage(response, EMBEDDING_FAIL_MSG);
        return ServiceResult.ok(response);
    }

    public void delete(UUID userId, UUID cardId) {
        BusinessCard card = cardRepository.findById(cardId)
                .orElseThrow(() -> new RuntimeException("Card not found"));

        if (!card.getUserId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }

        cardRepository.delete(card);
    }

    /**
     * 하이브리드 검색 (pg_trgm Fuzzy + pgvector Vector)을 수행한다.
     * 임베딩 생성 실패 시 Fuzzy 결과만 반환하고 경고 메시지를 포함한다.
     */
    public ServiceResult<List<CardResponse>> hybridSearch(UUID userId, String query, int topK) {

        // ── 1단계: 동적 임계값 Fuzzy 검색 ──────────────────────────────────
        double threshold = FUZZY_THRESHOLD_START;
        List<Map<String, Object>> fuzzyResults = Collections.emptyList();

        while (fuzzyResults.size() < topK && threshold >= FUZZY_THRESHOLD_MIN) {
            fuzzyResults = cardRepository.fuzzySearch(userId, query, threshold, topK);
            if (fuzzyResults.size() < topK) {
                threshold = Math.round((threshold - FUZZY_THRESHOLD_STEP) * 10.0) / 10.0;
            } else {
                break;
            }
        }

        Map<UUID, Double> fuzzyScoreMap = new HashMap<>();
        Map<UUID, Map<String, Object>> fuzzyRowMap = new HashMap<>();
        for (Map<String, Object> row : fuzzyResults) {
            UUID id = UUID.fromString(row.get("id").toString());
            double score = row.get("fuzzy_score") != null
                    ? ((Number) row.get("fuzzy_score")).doubleValue()
                    : 0.0;
            fuzzyScoreMap.put(id, score);
            fuzzyRowMap.put(id, row);
        }

        // ── 2단계: Vector 검색 ───────────────────────────────────────────────
        Map<UUID, Double> vectorScoreMap = new HashMap<>();
        Map<UUID, Map<String, Object>> vectorRowMap = new HashMap<>();
        boolean embeddingFailed = false;

        String queryEmbedding = embeddingService.getEmbedding(query);
        if (queryEmbedding != null) {
            List<Map<String, Object>> vectorResults = cardRepository.searchByVector(userId, queryEmbedding, topK);
            for (Map<String, Object> row : vectorResults) {
                UUID id = UUID.fromString(row.get("id").toString());
                double score = row.get("vector_score") != null
                        ? ((Number) row.get("vector_score")).doubleValue()
                        : 0.0;
                vectorScoreMap.put(id, score);
                vectorRowMap.put(id, row);
            }
        } else {
            embeddingFailed = true;
        }

        // ── 3단계: 점수 합산 및 최종 정렬 ───────────────────────────────────
        Set<UUID> allIds = new HashSet<>();
        allIds.addAll(fuzzyScoreMap.keySet());
        allIds.addAll(vectorScoreMap.keySet());

        List<CardResponse> results = new ArrayList<>();
        for (UUID id : allIds) {
            double fuzzyScore = fuzzyScoreMap.getOrDefault(id, 0.0);
            double vectorScore = vectorScoreMap.getOrDefault(id, 0.0);
            double combinedScore = fuzzyScore * FUZZY_WEIGHT + vectorScore * VECTOR_WEIGHT;

            Map<String, Object> row = fuzzyRowMap.containsKey(id) ? fuzzyRowMap.get(id) : vectorRowMap.get(id);
            CardResponse response = mapRowToCardResponse(row);
            response.setSimilarity(combinedScore);
            results.add(response);
        }

        results.sort((a, b) -> Double.compare(b.getSimilarity(), a.getSimilarity()));
        List<CardResponse> topResults = results.stream().limit(topK).toList();

        if (embeddingFailed) return ServiceResult.withMessage(topResults, EMBEDDING_FAIL_MSG);
        return ServiceResult.ok(topResults);
    }

    private CardResponse mapRowToCardResponse(Map<String, Object> row) {
        CardResponse cardResponse = new CardResponse();
        cardResponse.setId(UUID.fromString(row.get("id").toString()));
        cardResponse.setName((String) row.get("name"));
        cardResponse.setCompany((String) row.get("company"));
        cardResponse.setPosition((String) row.get("position"));
        cardResponse.setPhone((String) row.get("phone"));
        cardResponse.setEmail((String) row.get("email"));
        cardResponse.setRawOcrText((String) row.get("raw_ocr_text"));
        cardResponse.setImageUrl((String) row.get("image_url"));
        Object createdAtObj = row.get("created_at");
        if (createdAtObj instanceof Instant) {
            cardResponse.setCreatedAt(((Instant) createdAtObj).atZone(ZoneId.systemDefault()).toLocalDateTime());
        } else if (createdAtObj instanceof java.sql.Timestamp) {
            cardResponse.setCreatedAt(((java.sql.Timestamp) createdAtObj).toLocalDateTime());
        }
        return cardResponse;
    }

    private String buildEmbeddingText(String name, String company, String position,
                                       String phone, String email, String rawOcrText) {
        StringBuilder sb = new StringBuilder();
        if (name != null) sb.append(name).append(" ");
        if (company != null) sb.append(company).append(" ");
        if (position != null) sb.append(position).append(" ");
        if (phone != null) sb.append(phone).append(" ");
        if (email != null) sb.append(email).append(" ");
        if (rawOcrText != null) sb.append(rawOcrText);
        return sb.toString().trim();
    }
}
