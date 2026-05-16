package com.mora.dto.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    // 요청 성공 여부
    private boolean success;
    // 성공 시 응답 데이터
    private T data;
    // 실패 시 에러 메시지
    private String error;
    // 부분 성공 시 경고 메시지 (예: 임베딩 실패로 Fuzzy만 반환)
    private String message;

    // 응답 성공한 경우
    public static <T> ApiResponse<T> ok(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(true);
        response.setData(data);
        return response;
    }

    // 응답 실패한 경우
    public static <T> ApiResponse<T> fail(String error) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setError(error);
        return response;
    }
}
