package com.mora.dto.llm;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChatRequest {
    private String query;

    @JsonAlias("document_type")
    private String documentType;

    @JsonAlias("top_k")
    private int topK = 5;
}
