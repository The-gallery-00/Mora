package com.mora.dto.api;

/**
 * @param <T> 실제 반환 데이터 타입
 */
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
