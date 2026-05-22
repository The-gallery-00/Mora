package com.mora.dto.api;

//임베딩 실패 시 경고 메시지와 데이터를 반환하기 위한 클래스.
public class ServiceResult<T> {

    private final T data;
    private final String message; // null = 경고 없음

    private ServiceResult(T data, String message) {
        this.data = data;
        this.message = message;
    }

    // 경고 없는 정상 결과
    public static <T> ServiceResult<T> ok(T data) {
        return new ServiceResult<>(data, null);
    }

    // 경고 메시지 포함 결과
    public static <T> ServiceResult<T> withMessage(T data, String message) {
        return new ServiceResult<>(data, message);
    }

    public T getData() { return data; }
    public String getMessage() { return message; }
    public boolean hasMessage() { return message != null; }
}
