package com.mora.service;

import com.mora.dto.AuthResponse;
import com.mora.dto.LoginRequest;
import com.mora.dto.OAuthUserResponse;
import com.mora.dto.SignupRequest;
import com.mora.entity.User;
import com.mora.entity.UserAuthProvider;
import com.mora.repository.UserAuthProviderRepository;
import com.mora.repository.UserRepository;
import com.mora.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * ═══════════════════════════════════════════════════════════════
 * AuthService — 인증(Authentication) 비즈니스 로직 서비스
 * ═══════════════════════════════════════════════════════════════
 *
 * [역할]
 * 회원가입, 로그인, 사용자 조회 등 인증 관련 비즈니스 로직을 처리한다.
 * AuthController에서 호출되며, UserRepository를 통해 DB에 접근하고,
 * PasswordEncoder로 비밀번호를 해싱/검증하고,
 * JwtUtil로 JWT 토큰을 발급한다.
 *
 * [코드 흐름]
 * 1) 회원가입 (signup):
 *    → 이메일 중복 확인 → User 엔티티 생성 → 비밀번호 BCrypt 해싱
 *    → DB 저장 → JWT 토큰 생성 → AuthResponse 반환
 * 2) 로그인 (login):
 *    → 이메일로 사용자 조회 → 비밀번호 BCrypt 검증
 *    → JWT 토큰 생성 → AuthResponse 반환
 * 3) 사용자 조회 (getUserById):
 *    → UUID로 사용자 조회 → User 엔티티 반환
 *
 * [메서드 목록]
 * - signup(SignupRequest): 회원가입 처리. 이메일 중복 확인 후 사용자를 생성하고 JWT를 발급한다.
 * - login(LoginRequest): 로그인 처리. 이메일/비밀번호 검증 후 JWT를 발급한다.
 * - getUserById(UUID): 사용자 ID로 User 엔티티를 조회한다.
 *
 * [사용된 어노테이션/라이브러리]
 * ───────────────────────────────────────────
 * @Service
 *   — 이 클래스가 서비스 계층의 빈임을 선언한다.
 *     Spring이 자동으로 빈으로 등록하여 다른 클래스에서 주입 가능하게 한다.
 *
 * PasswordEncoder (Spring Security)
 *   — encode(rawPassword): 평문 비밀번호를 BCrypt로 해싱한다.
 *   — matches(rawPassword, encodedPassword): 평문과 해시 값을 비교·검증한다.
 *
 * JwtUtil
 *   — generateToken(userId, email): 사용자 정보를 담은 JWT 토큰을 생성한다.
 *
 * UserRepository
 *   — existsByEmail(): 이메일 중복 확인.
 *   — save(): User 엔티티를 DB에 저장(INSERT).
 *   — findByEmail(): 이메일로 사용자 조회.
 *   — findById(): UUID로 사용자 조회.
 * ───────────────────────────────────────────
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final UserAuthProviderRepository userAuthProviderRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository,
                       UserAuthProviderRepository userAuthProviderRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.userAuthProviderRepository = userAuthProviderRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    /**
     * 회원가입을 처리한다.
     * 이메일 중복 시 RuntimeException을 던진다.
     */
    public AuthResponse signup(SignupRequest request) {
        validateSignupRequest(request);

        // 이메일 중복 확인
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists");
        }

        // User 엔티티 생성 및 필드 설정
        User user = new User();
        user.setProvider("local");  // 직접 가입 = "local" 제공자
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));  // BCrypt 해싱
        user.setName(request.getName());

        // DB에 저장 (JPA가 UUID 자동 생성, @PrePersist로 createdAt 설정)
        user = userRepository.save(user);
        // JWT 토큰 생성
        String token = jwtUtil.generateToken(user.getId(), user.getEmail());

        return new AuthResponse(token, user.getId(), user.getEmail(), user.getName());
    }

    /**
     * 로그인을 처리한다.
     * 이메일이 없거나 비밀번호가 불일치하면 RuntimeException을 던진다.
     */
    public AuthResponse login(LoginRequest request) {
        validateLoginRequest(request);

        // 이메일로 사용자 조회 (없으면 예외)
        User bsUser = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        // 소셜 로그인 전용 계정은 passwordHash가 없을 수 있으므로,
        // null 비교를 먼저 막아야 BCrypt 내부 예외 대신 일관된 로그인 실패 응답을 줄 수 있다.
        if (isBlank(bsUser.getPasswordHash())) {
            throw new RuntimeException("This account requires social login");
        }

        // 입력된 평문 비밀번호와 저장된 BCrypt 해시를 비교
        if (!passwordEncoder.matches(request.getPassword(), bsUser.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        // JWT 토큰 생성
        String bsToken = jwtUtil.generateToken(bsUser.getId(), bsUser.getEmail());

        return new AuthResponse(bsToken, bsUser.getId(), bsUser.getEmail(), bsUser.getName());
    }

    /**
     * 소셜 로그인 제공자에서 받은 사용자 정보를 기준으로
     * 기존 계정 조회/연결/생성을 수행한 뒤 동일한 JWT 응답을 반환한다.
     *
     * [왜 AuthService에서 처리하는가]
     * provider별 API 호출은 각 OAuth 서비스가 맡되,
     * "우리 서비스 사용자 계정을 어떻게 연결할 것인가"는
     * 인증 도메인의 핵심 규칙이므로 한곳에서 통일해야 한다.
     * 그래야 Google/Kakao/Naver가 모두 같은 충돌 처리 정책을 따른다.
     */
    public AuthResponse loginWithOAuth(OAuthUserResponse bsProfile) {
        validateOAuthUserResponse(bsProfile);

        UserAuthProvider userAuthProvider = userAuthProviderRepository
                .findByProviderAndProviderUserId(bsProfile.getProvider(), bsProfile.getProviderUserId())
                .orElse(null);

        User bsUser;
        if (userAuthProvider != null) {
            bsUser = getUserById(userAuthProvider.getUserId());
        } else {
            // 이메일이 같은 기존 계정이 있으면 그 계정에 소셜 로그인만 연결한다.
            // 별도 계정을 다시 만들지 않는 이유는 프론트와 카드 데이터가 모두 userId에 묶여 있어서,
            // 같은 사람인데 계정이 갈라지면 기존 데이터 접근이 끊기기 때문이다.
            bsUser = userRepository.findByEmail(bsProfile.getEmail())
                    .orElseGet(() -> createOAuthUser(bsProfile));
            userAuthProvider = createUserAuthProvider(bsUser, bsProfile);
        }

        updateOAuthUserProfile(bsUser, bsProfile);
        updateUserAuthProviderProfile(userAuthProvider, bsProfile);

        String bsToken = jwtUtil.generateToken(bsUser.getId(), bsUser.getEmail());
        return new AuthResponse(bsToken, bsUser.getId(), bsUser.getEmail(), bsUser.getName());
    }

    /**
     * 사용자 ID(UUID)로 User 엔티티를 조회한다.
     * 존재하지 않으면 RuntimeException을 던진다.
     */
    public User getUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private void validateSignupRequest(SignupRequest request) {
        if (request == null || isBlank(request.getEmail()) || isBlank(request.getPassword()) || isBlank(request.getName())) {
            throw new RuntimeException("Email, password and name are required");
        }
    }

    private void validateLoginRequest(LoginRequest request) {
        if (request == null || isBlank(request.getEmail()) || isBlank(request.getPassword())) {
            throw new RuntimeException("Email and password are required");
        }
    }

    private void validateOAuthUserResponse(OAuthUserResponse bsProfile) {
        if (bsProfile == null || isBlank(bsProfile.getProvider()) || isBlank(bsProfile.getProviderUserId())) {
            throw new RuntimeException("OAuth provider information is missing");
        }
        if (isBlank(bsProfile.getEmail())) {
            // 현재 users.email 컬럼은 NOT NULL + UNIQUE 이다.
            // 그래서 이메일이 없는 소셜 계정을 강제로 저장하면 DB 제약을 깨거나
            // 임시 이메일로 잘못 연결될 수 있다. 명시적으로 실패시켜 안전하게 막는다.
            throw new RuntimeException("Email is required from OAuth provider");
        }
        if (isBlank(bsProfile.getName())) {
            bsProfile.setName(bsProfile.getEmail().split("@")[0]);
        }
    }

    private User createOAuthUser(OAuthUserResponse bsProfile) {
        User bsUser = new User();
        bsUser.setProvider(bsProfile.getProvider());
        bsUser.setEmail(bsProfile.getEmail());
        bsUser.setName(bsProfile.getName());
        bsUser.setPicture(bsProfile.getPicture());
        return userRepository.save(bsUser);
    }

    private UserAuthProvider createUserAuthProvider(User bsUser, OAuthUserResponse bsProfile) {
        UserAuthProvider userAuthProvider = new UserAuthProvider();
        userAuthProvider.setUserId(bsUser.getId());
        userAuthProvider.setProvider(bsProfile.getProvider());
        userAuthProvider.setProviderUserId(bsProfile.getProviderUserId());
        userAuthProvider.setProviderEmail(bsProfile.getEmail());
        userAuthProvider.setProviderName(bsProfile.getName());
        userAuthProvider.setPicture(bsProfile.getPicture());
        return userAuthProviderRepository.save(userAuthProvider);
    }

    private void updateOAuthUserProfile(User bsUser, OAuthUserResponse bsProfile) {
        boolean hasChanged = false;

        // 기존 로컬 사용자의 이름을 무조건 덮어쓰지 않는 이유는
        // 사용자가 서비스 안에서 수정한 프로필이 더 신뢰할 수 있기 때문이다.
        if (isBlank(bsUser.getName()) && !isBlank(bsProfile.getName())) {
            bsUser.setName(bsProfile.getName());
            hasChanged = true;
        }
        if (isBlank(bsUser.getPicture()) && !isBlank(bsProfile.getPicture())) {
            bsUser.setPicture(bsProfile.getPicture());
            hasChanged = true;
        }
        if (isBlank(bsUser.getProvider())) {
            bsUser.setProvider(bsProfile.getProvider());
            hasChanged = true;
        }

        if (hasChanged) {
            userRepository.save(bsUser);
        }
    }

    private void updateUserAuthProviderProfile(UserAuthProvider userAuthProvider, OAuthUserResponse bsProfile) {
        boolean hasChanged = false;

        if (!equalsNullable(userAuthProvider.getProviderEmail(), bsProfile.getEmail())) {
            userAuthProvider.setProviderEmail(bsProfile.getEmail());
            hasChanged = true;
        }
        if (!equalsNullable(userAuthProvider.getProviderName(), bsProfile.getName())) {
            userAuthProvider.setProviderName(bsProfile.getName());
            hasChanged = true;
        }
        if (!equalsNullable(userAuthProvider.getPicture(), bsProfile.getPicture())) {
            userAuthProvider.setPicture(bsProfile.getPicture());
            hasChanged = true;
        }

        if (hasChanged) {
            userAuthProviderRepository.save(userAuthProvider);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean equalsNullable(String left, String right) {
        if (left == null) {
            return right == null;
        }
        return left.equals(right);
    }
}
