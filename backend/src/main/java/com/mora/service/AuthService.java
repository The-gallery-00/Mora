package com.mora.service;

import com.mora.dto.auth.AuthResponse;
import com.mora.dto.auth.LoginRequest;
import com.mora.dto.oauth.OAuthUserResponse;
import com.mora.dto.auth.SignupRequest;
import com.mora.entity.user.User;
import com.mora.entity.user.UserAuthProvider;
import com.mora.repository.UserAuthProviderRepository;
import com.mora.repository.UserRepository;
import com.mora.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

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
