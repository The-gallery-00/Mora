package com.mora.service;

import com.mora.dto.search.SearchHistoryResponse;
import com.mora.entity.SearchHistory;
import com.mora.repository.SearchHistoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SearchHistoryService {

    private final SearchHistoryRepository searchHistoryRepository;

    public SearchHistoryService(SearchHistoryRepository searchHistoryRepository) {
        this.searchHistoryRepository = searchHistoryRepository;
    }

    @Transactional
    public void record(UUID userId, String documentType, String query) {
        if (userId == null || documentType == null || documentType.isBlank() || query == null || query.isBlank()) {
            return;
        }

        SearchHistory history = new SearchHistory();
        history.setUserId(userId);
        history.setDocumentType(documentType);
        history.setQuery(query.trim());
        searchHistoryRepository.save(history);
    }

    public List<SearchHistoryResponse> list(UUID userId) {
        validateUserId(userId);
        return searchHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(SearchHistoryResponse::from)
                .toList();
    }

    @Transactional
    public long deleteAll(UUID userId) {
        validateUserId(userId);
        long count = searchHistoryRepository.countByUserId(userId);
        searchHistoryRepository.deleteByUserId(userId);
        return count;
    }

    private void validateUserId(UUID userId) {
        if (userId == null) {
            throw new RuntimeException("사용자 ID가 필요합니다.");
        }
    }
}
