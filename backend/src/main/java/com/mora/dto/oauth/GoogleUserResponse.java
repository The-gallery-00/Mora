package com.mora.dto.oauth;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GoogleUserResponse {

    private String id;
    private String email;

    @JsonProperty("verified_email")
    private Boolean verifiedEmail;

    private String name;
    private String picture;
}
