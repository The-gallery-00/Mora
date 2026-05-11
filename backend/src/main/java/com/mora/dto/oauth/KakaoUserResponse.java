package com.mora.dto.oauth;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class KakaoUserResponse {

    private Long id;
    private JsonNode properties;
    private JsonNode kakaoAccount;
}
