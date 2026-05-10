package com.mora.dto;

import com.fasterxml.jackson.databind.JsonNode;

public class NaverUserResponse {

    private String resultcode;
    private String message;
    private JsonNode response;

    public NaverUserResponse() {
    }

    public String getResultcode() {
        return resultcode;
    }

    public void setResultcode(String resultcode) {
        this.resultcode = resultcode;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public JsonNode getResponse() {
        return response;
    }

    public void setResponse(JsonNode response) {
        this.response = response;
    }
}
