package com.mora.dto.search;

import com.mora.entity.SearchHistory;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@AllArgsConstructor
public class SearchHistoryResponse {

    private UUID id;
    private String documentType;
    private String query;
    private LocalDateTime createdAt;

    public static SearchHistoryResponse from(SearchHistory history) {
        return new SearchHistoryResponse(
                history.getId(),
                history.getDocumentType(),
                history.getQuery(),
                history.getCreatedAt()
        );
    }
}
