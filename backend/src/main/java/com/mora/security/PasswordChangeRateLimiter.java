package com.mora.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 비밀번호 변경 엔드포인트 전용 rate limiter.
 * 클라이언트 식별 키(IP + 토큰 일부) 당 분당 5회로 제한해
 * 현재 비밀번호 무차별 대입 비용을 높인다.
 *
 * 분산 환경에서는 인메모리 캐시가 노드별로 분리되므로
 * 추후 Redis 기반 Bucket4j 백엔드로 교체할 수 있다.
 */
@Component
public class PasswordChangeRateLimiter {

    private static final int MAX_REQUESTS_PER_MINUTE = 5;

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public boolean tryConsume(String clientKey) {
        Bucket bucket = buckets.computeIfAbsent(clientKey, key -> newBucket());
        return bucket.tryConsume(1);
    }

    private Bucket newBucket() {
        Bandwidth limit = Bandwidth.classic(
                MAX_REQUESTS_PER_MINUTE,
                Refill.greedy(MAX_REQUESTS_PER_MINUTE, Duration.ofMinutes(1))
        );
        return Bucket.builder().addLimit(limit).build();
    }
}
