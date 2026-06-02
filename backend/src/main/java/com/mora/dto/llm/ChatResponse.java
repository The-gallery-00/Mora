package com.mora.dto.llm;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class ChatResponse {
    private String answer;
    private List<Map<String, Object>> sources;
    private String query;
}
