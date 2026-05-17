package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.dto.auth.AuthResponse;
import com.mora.dto.auth.LoginRequest;
import com.mora.dto.auth.SignupRequest;
import com.mora.dto.oauth.OAuthUserResponse;
import com.mora.dto.user.UserResponse;
import com.mora.entity.user.User;
import com.mora.security.JwtUtil;
import com.mora.service.AuthService;
import com.mora.service.GoogleOAuthService;
import com.mora.service.KakaoOAuthService;
import com.mora.service.NaverOAuthService;
import com.mora.service.OAuthStateService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final GoogleOAuthService googleOAuthService;
    private final KakaoOAuthService kakaoOAuthService;
    private final NaverOAuthService naverOAuthService;
    private final OAuthStateService oauthStateService;
    private final String frontendUrl;

    public AuthController(AuthService authService,
                          JwtUtil jwtUtil,
                          GoogleOAuthService googleOAuthService,
                          KakaoOAuthService kakaoOAuthService,
                          NaverOAuthService naverOAuthService,
                          OAuthStateService oauthStateService,
                          @Value("${app.frontend-url}") String frontendUrl) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.googleOAuthService = googleOAuthService;
        this.kakaoOAuthService = kakaoOAuthService;
        this.naverOAuthService = naverOAuthService;
        this.oauthStateService = oauthStateService;
        this.frontendUrl = normalizeFrontendUrl(frontendUrl);
    }

    /**
     * 회원가입 엔드포인트.
     * 이메일 중복 시 400 에러를 반환한다.
     */
    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<AuthResponse>> signup(@RequestBody SignupRequest request) {
        try {
            AuthResponse response = authService.signup(request);
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 로그인 엔드포인트.
     * 이메일/비밀번호 불일치 시 400 에러를 반환한다.
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@RequestBody LoginRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 현재 로그인한 사용자의 정보를 조회하는 엔드포인트.
     * Authorization 헤더에서 JWT 토큰을 추출하여 사용자를 식별한다.
     * 토큰이 없거나 유효하지 않으면 401 에러를 반환한다.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> me(HttpServletRequest request) {
        try {
            // Authorization 헤더에서 Bearer 토큰 추출
            String header = request.getHeader("Authorization");
            if (header == null || !header.startsWith("Bearer "))
                return ResponseEntity.status(401).body(ApiResponse.fail("Token required"));

            // JWT에서 userId 추출 → DB에서 사용자 조회
            UUID userId = jwtUtil.getUserId(header.substring(7));
            User user = authService.getUserById(userId);
            UserResponse response = new UserResponse(user.getId(), user.getEmail(), user.getName(), user.getPicture());
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * Google OAuth 로그인 시작 엔드포인트.
     * 리다이렉트 방식은 프론트가 provider SDK를 직접 들고 있지 않아도 되므로
     * 현재 "백엔드만 수정" 제약과 가장 잘 맞는다.
     */
    @GetMapping("/google/login")
    public ResponseEntity<Void> googleLogin() {
        return createOAuthRedirectResponse(googleOAuthService.getAuthorizationUrl(oauthStateService.createState("google")));
    }

    @GetMapping(value = "/google/callback", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> googleCallback(@RequestParam(required = false) String code,
                                                 @RequestParam(required = false) String state,
                                                 @RequestParam(required = false) String error) {
        return handleOAuthCallback("google", code, state, error);
    }

    @GetMapping("/kakao/login")
    public ResponseEntity<Void> kakaoLogin() {
        return createOAuthRedirectResponse(kakaoOAuthService.getAuthorizationUrl(oauthStateService.createState("kakao")));
    }

    @GetMapping(value = "/kakao/callback", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> kakaoCallback(@RequestParam(required = false) String code,
                                                @RequestParam(required = false) String state,
                                                @RequestParam(required = false) String error) {
        return handleOAuthCallback("kakao", code, state, error);
    }

    @GetMapping("/naver/login")
    public ResponseEntity<Void> naverLogin() {
        return createOAuthRedirectResponse(naverOAuthService.getAuthorizationUrl(oauthStateService.createState("naver")));
    }

    @GetMapping(value = "/naver/callback", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> naverCallback(@RequestParam(required = false) String code,
                                                @RequestParam(required = false) String state,
                                                @RequestParam(required = false) String error) {
        return handleOAuthCallback("naver", code, state, error);
    }

    private ResponseEntity<Void> createOAuthRedirectResponse(String redirectUrl) {
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, redirectUrl)
                .build();
    }

    private ResponseEntity<String> handleOAuthCallback(String provider, String code, String state, String error) {
        try {
            if (error != null && !error.isBlank()) {
                return buildOAuthHtmlResponse(HttpStatus.BAD_REQUEST, buildOAuthFailureHtml(error));
            }
            if (!oauthStateService.isValid(provider, state)) {
                return buildOAuthHtmlResponse(HttpStatus.BAD_REQUEST, buildOAuthFailureHtml("Invalid OAuth state"));
            }

            OAuthUserResponse bsProfile = switch (provider) {
                case "google" -> googleOAuthService.getUserProfileByCode(code);
                case "kakao" -> kakaoOAuthService.getUserProfileByCode(code);
                case "naver" -> naverOAuthService.getUserProfileByCode(code, state);
                default -> throw new RuntimeException("Unsupported OAuth provider");
            };

            AuthResponse bsResponse = authService.loginWithOAuth(bsProfile);
            return buildOAuthHtmlResponse(HttpStatus.OK, buildOAuthSuccessHtml(bsResponse));
        } catch (RuntimeException e) {
            log.warn("OAuth callback failed. provider={}, message={}", provider, e.getMessage(), e);
            return buildOAuthHtmlResponse(HttpStatus.BAD_REQUEST, buildOAuthFailureHtml(e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected OAuth callback error. provider={}", provider, e);
            return buildOAuthHtmlResponse(HttpStatus.INTERNAL_SERVER_ERROR, buildOAuthFailureHtml("OAuth login failed. Please check backend logs."));
        }
    }

    private ResponseEntity<String> buildOAuthHtmlResponse(HttpStatus status, String html) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        return new ResponseEntity<>(html, headers, status);
    }

    private String buildOAuthSuccessHtml(AuthResponse bsResponse) {
        String safeFrontendUrl = escapeJs(frontendUrl);
        String safeToken = escapeJs(bsResponse.getToken());
        String safeUserId = escapeJs(String.valueOf(bsResponse.getUserId()));
        String safeEmail = escapeJs(bsResponse.getEmail());
        String safeName = escapeJs(bsResponse.getName());

        // 이 HTML 브리지는 백엔드만 수정하는 현재 조건에서
        // 리다이렉트 기반 OAuth 결과를 프론트로 넘기기 위한 최소 대응이다.
        // 같은 origin 배포에서는 localStorage 저장 후 바로 대시보드 이동이 가능하고,
        // 개발 환경처럼 origin이 다르면 query/postMessage로도 결과를 넘겨
        // 프론트가 최소 변경으로 수신할 수 있도록 대비한다.
        return """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8" />
                    <title>MORA OAuth Login</title>
                </head>
                <body style="font-family: sans-serif; padding: 32px;">
                    <p>로그인 처리 중입니다. 잠시만 기다려 주세요.</p>
                    <script>
                        (function () {
                            const authPayload = {
                                token: '%s',
                                userId: '%s',
                                email: '%s',
                                name: '%s'
                            };

                            try {
                                localStorage.setItem('mora_token', authPayload.token);
                                localStorage.setItem('mora_user', JSON.stringify({
                                    id: authPayload.userId,
                                    email: authPayload.email,
                                    name: authPayload.name
                                }));
                            } catch (e) {
                                console.warn('Unable to write localStorage in OAuth callback page.', e);
                            }

                            try {
                                if (window.opener) {
                                    window.opener.postMessage({ type: 'MORA_OAUTH_LOGIN', payload: authPayload }, '%s');
                                    window.close();
                                    return;
                                }
                            } catch (e) {
                                console.warn('Unable to postMessage OAuth result.', e);
                            }

                            const redirectUrl = '%s' + '/dashboard'
                                + '?token=' + encodeURIComponent(authPayload.token)
                                + '&userId=' + encodeURIComponent(authPayload.userId)
                                + '&email=' + encodeURIComponent(authPayload.email)
                                + '&name=' + encodeURIComponent(authPayload.name);
                            window.location.replace(redirectUrl);
                        })();
                    </script>
                </body>
                </html>
                """.formatted(safeToken, safeUserId, safeEmail, safeName, safeFrontendUrl, safeFrontendUrl);
    }

    private String buildOAuthFailureHtml(String message) {
        String safeMessage = escapeHtml(message == null ? "OAuth login failed" : message);
        return """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8" />
                    <title>MORA OAuth Login Failed</title>
                </head>
                <body style="font-family: sans-serif; padding: 32px;">
                    <h2>소셜 로그인에 실패했습니다.</h2>
                    <p>%s</p>
                    <p>브라우저를 닫고 다시 시도해 주세요.</p>
                </body>
                </html>
                """.formatted(safeMessage);
    }

    private String escapeJs(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\"", "\\\"");
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String normalizeFrontendUrl(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.replaceAll("/+$", "");
    }
}
