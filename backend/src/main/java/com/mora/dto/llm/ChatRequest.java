package com.mora.dto.llm;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChatRequest {
    private String query;
    private String documentType;
    private int topK = 5;
}
