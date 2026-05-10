package com.mora.dto;

import com.fasterxml.jackson.databind.JsonNode;

public class KakaoUserResponse {

    private Long id;
    private JsonNode properties;
    private JsonNode kakaoAccount;

    public KakaoUserResponse() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public JsonNode getProperties() {
        return properties;
    }

    public void setProperties(JsonNode properties) {
        this.properties = properties;
    }

    public JsonNode getKakaoAccount() {
        return kakaoAccount;
    }

    public void setKakaoAccount(JsonNode kakaoAccount) {
        this.kakaoAccount = kakaoAccount;
    }
}
